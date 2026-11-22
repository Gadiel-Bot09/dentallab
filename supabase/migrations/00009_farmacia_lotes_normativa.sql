-- ============================================================================
-- supabase/migrations/00009_farmacia_lotes_normativa.sql
-- Control normativo de recepción técnica de insumos y medicamentos:
--   - Catálogo de Proveedores (NIT, razón social, contacto)
--   - Datos normativos en catálogo maestro `inventario` (código de barras,
--     registro sanitario INVIMA, clasificación de riesgo, fabricante,
--     presentación, condiciones de almacenamiento, IVA, control lote/vto)
--   - Actas de Recepción Técnica (`recepciones_farmacia` + `recepcion_items`)
--     conforme a Resolución 1403/2007, Decreto 4725/2005 y Res. 3100/2019
--   - Control de Lotes y Fechas de Vencimiento por Farmacia (`lotes_farmacia`)
--     con lógica FEFO (First Expired, First Out) automática en despachos
--   - Gestión de Cuarentena / Liberación / Retiro auditable en Kardex
-- ============================================================================

-- =====================================================================
-- 1. CATÁLOGO DE PROVEEDORES
-- =====================================================================
CREATE TABLE IF NOT EXISTS proveedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nit TEXT UNIQUE NOT NULL,
    razon_social TEXT NOT NULL,
    nombre_comercial TEXT,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    ciudad TEXT,
    contacto_nombre TEXT,
    observaciones TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proveedores_razon ON proveedores(razon_social);
CREATE INDEX IF NOT EXISTS idx_proveedores_nit ON proveedores(nit);

-- =====================================================================
-- 2. CAMPOS NORMATIVOS EN CATÁLOGO MAESTRO `inventario`
-- =====================================================================
ALTER TABLE inventario
  ADD COLUMN IF NOT EXISTS codigo_barras TEXT,
  ADD COLUMN IF NOT EXISTS registro_sanitario TEXT,
  ADD COLUMN IF NOT EXISTS clasificacion_riesgo TEXT DEFAULT 'insumo_general',
  ADD COLUMN IF NOT EXISTS laboratorio_fabricante TEXT,
  ADD COLUMN IF NOT EXISTS presentacion_comercial TEXT,
  ADD COLUMN IF NOT EXISTS forma_farmaceutica TEXT,
  ADD COLUMN IF NOT EXISTS concentracion TEXT,
  ADD COLUMN IF NOT EXISTS principio_activo TEXT,
  ADD COLUMN IF NOT EXISTS codigo_cum TEXT,
  ADD COLUMN IF NOT EXISTS condiciones_almacenamiento TEXT NOT NULL DEFAULT 'ambiente',
  ADD COLUMN IF NOT EXISTS requiere_lote BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS requiere_vencimiento BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS iva_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_inv_clasificacion_riesgo') THEN
    ALTER TABLE inventario
      ADD CONSTRAINT chk_inv_clasificacion_riesgo
      CHECK (clasificacion_riesgo IS NULL OR clasificacion_riesgo IN ('I','IIa','IIb','III','medicamento','insumo_general','no_aplica'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_inv_condiciones_alm') THEN
    ALTER TABLE inventario
      ADD CONSTRAINT chk_inv_condiciones_alm
      CHECK (condiciones_almacenamiento IN ('ambiente','refrigerado','congelado','protegido_luz','controlado'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_inv_iva_porcentaje') THEN
    ALTER TABLE inventario
      ADD CONSTRAINT chk_inv_iva_porcentaje
      CHECK (iva_porcentaje >= 0 AND iva_porcentaje <= 100);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventario_codigo_barras_uniq
  ON inventario (codigo_barras)
  WHERE codigo_barras IS NOT NULL AND trim(codigo_barras) <> '';

-- =====================================================================
-- 3. ACTAS DE RECEPCIÓN TÉCNICA Y ADMINISTRATIVA (`recepciones_farmacia`)
-- =====================================================================
CREATE TABLE IF NOT EXISTS recepciones_farmacia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    radicado TEXT UNIQUE NOT NULL,
    farmacia_id UUID NOT NULL REFERENCES farmacias(id) ON DELETE RESTRICT,
    proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
    proveedor_nombre TEXT,
    proveedor_nit TEXT,
    tipo_documento TEXT NOT NULL DEFAULT 'factura'
      CHECK (tipo_documento IN ('factura','remision','orden_compra','donacion','traslado','otro')),
    numero_documento TEXT,
    fecha_documento DATE,
    fecha_recepcion TIMESTAMPTZ NOT NULL DEFAULT now(),
    temperatura_recepcion NUMERIC(5,2),
    humedad_recepcion NUMERIC(5,2),
    condiciones_empaque_ok BOOLEAN NOT NULL DEFAULT true,
    cadena_frio_ok BOOLEAN NOT NULL DEFAULT true,
    dictamen_tecnico TEXT NOT NULL DEFAULT 'aprobado'
      CHECK (dictamen_tecnico IN ('aprobado','aprobado_con_observaciones','cuarentena','rechazado')),
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    descuento_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    iva_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    observaciones TEXT,
    recibido_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recepciones_farmacia_farm ON recepciones_farmacia(farmacia_id, fecha_recepcion DESC);
CREATE INDEX IF NOT EXISTS idx_recepciones_farmacia_prov ON recepciones_farmacia(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_recepciones_farmacia_doc ON recepciones_farmacia(numero_documento);

-- =====================================================================
-- 4. CONTROL DE LOTES Y VENCIMIENTOS POR FARMACIA (`lotes_farmacia`)
-- =====================================================================
CREATE TABLE IF NOT EXISTS lotes_farmacia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmacia_id UUID NOT NULL REFERENCES farmacias(id) ON DELETE RESTRICT,
    material_id UUID NOT NULL REFERENCES inventario(id) ON DELETE RESTRICT,
    numero_lote TEXT NOT NULL,
    fecha_vencimiento DATE,
    fecha_fabricacion DATE,
    codigo_barras TEXT,
    registro_sanitario TEXT,
    laboratorio_fabricante TEXT,
    presentacion TEXT,
    condiciones_almacenamiento TEXT NOT NULL DEFAULT 'ambiente'
      CHECK (condiciones_almacenamiento IN ('ambiente','refrigerado','congelado','protegido_luz','controlado')),
    proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
    proveedor_nombre TEXT,
    recepcion_id UUID REFERENCES recepciones_farmacia(id) ON DELETE SET NULL,
    cantidad_inicial NUMERIC(12,2) NOT NULL CHECK (cantidad_inicial >= 0),
    cantidad_disponible NUMERIC(12,2) NOT NULL CHECK (cantidad_disponible >= 0),
    costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
    iva_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 0,
    precio_venta_sugerido NUMERIC(12,2),
    estado TEXT NOT NULL DEFAULT 'disponible'
      CHECK (estado IN ('disponible','cuarentena','vencido','agotado','retirado')),
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lotes_farmacia_fefo
  ON lotes_farmacia (farmacia_id, material_id, estado, fecha_vencimiento ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_lotes_farmacia_vto
  ON lotes_farmacia (fecha_vencimiento) WHERE estado = 'disponible' AND cantidad_disponible > 0;
CREATE INDEX IF NOT EXISTS idx_lotes_farmacia_barcode
  ON lotes_farmacia (codigo_barras) WHERE codigo_barras IS NOT NULL;

-- =====================================================================
-- 5. DETALLE DE ÍTEMS POR RECEPCIÓN (`recepcion_items`)
-- =====================================================================
CREATE TABLE IF NOT EXISTS recepcion_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recepcion_id UUID NOT NULL REFERENCES recepciones_farmacia(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES inventario(id) ON DELETE RESTRICT,
    lote_id UUID REFERENCES lotes_farmacia(id) ON DELETE SET NULL,
    numero_lote TEXT,
    fecha_vencimiento DATE,
    fecha_fabricacion DATE,
    codigo_barras TEXT,
    registro_sanitario TEXT,
    laboratorio_fabricante TEXT,
    presentacion TEXT,
    cantidad NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
    costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
    descuento_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 0,
    iva_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    valor_descuento NUMERIC(14,2) NOT NULL DEFAULT 0,
    valor_iva NUMERIC(14,2) NOT NULL DEFAULT 0,
    valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    precio_venta_sugerido NUMERIC(12,2),
    cumple_especificaciones BOOLEAN NOT NULL DEFAULT true,
    condiciones_almacenamiento TEXT NOT NULL DEFAULT 'ambiente'
      CHECK (condiciones_almacenamiento IN ('ambiente','refrigerado','congelado','protegido_luz','controlado')),
    estado_recepcion TEXT NOT NULL DEFAULT 'disponible'
      CHECK (estado_recepcion IN ('disponible','cuarentena','rechazado')),
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recepcion_items_rec ON recepcion_items(recepcion_id);
CREATE INDEX IF NOT EXISTS idx_recepcion_items_mat ON recepcion_items(material_id);

-- =====================================================================
-- 6. ENRIQUECER KARDEX (`movimientos_farmacia`) CON TRAZABILIDAD DE LOTE
-- =====================================================================
ALTER TABLE movimientos_farmacia
  ADD COLUMN IF NOT EXISTS recepcion_id UUID REFERENCES recepciones_farmacia(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS numero_lote TEXT,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mov_farm_lote') THEN
    ALTER TABLE movimientos_farmacia
      ADD CONSTRAINT fk_mov_farm_lote
      FOREIGN KEY (lote_id) REFERENCES lotes_farmacia(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mov_farm_lote ON movimientos_farmacia(lote_id) WHERE lote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mov_farm_recepcion ON movimientos_farmacia(recepcion_id) WHERE recepcion_id IS NOT NULL;

-- =====================================================================
-- 7. MOVIMIENTO DE STOCK CON SOPORTE DE LOTE Y DESCARGA FEFO AUTOMÁTICA
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_mover_stock_lote(
  p_farmacia_id UUID, p_material_id UUID, p_delta NUMERIC, p_tipo mov_farmacia_tipo,
  p_costo NUMERIC, p_solicitud_id UUID, p_devolucion_id UUID, p_area_id UUID,
  p_motivo TEXT, p_proveedor TEXT, p_documento TEXT,
  p_lote_id UUID DEFAULT NULL, p_recepcion_id UUID DEFAULT NULL,
  p_numero_lote TEXT DEFAULT NULL, p_fecha_vencimiento DATE DEFAULT NULL
) RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stock stock_farmacia%ROWTYPE;
  v_resultante NUMERIC;
  v_costo NUMERIC;
  v_nuevo_prom NUMERIC;
  v_nombre TEXT;
  v_lote_id UUID := p_lote_id;
  v_num_lote TEXT := NULLIF(trim(coalesce(p_numero_lote, '')), '');
  v_f_vto DATE := p_fecha_vencimiento;
  v_restante NUMERIC;
  v_lote RECORD;
  v_descontar NUMERIC;
BEGIN
  IF p_delta = 0 THEN RAISE EXCEPTION 'La cantidad del movimiento no puede ser cero'; END IF;

  INSERT INTO stock_farmacia (farmacia_id, material_id, cantidad, costo_promedio)
  SELECT p_farmacia_id, p_material_id, 0, coalesce(i.precio_unitario, 0) FROM inventario i WHERE i.id = p_material_id
  ON CONFLICT (farmacia_id, material_id) DO NOTHING;

  SELECT * INTO v_stock FROM stock_farmacia
  WHERE farmacia_id = p_farmacia_id AND material_id = p_material_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Insumo no encontrado en el catálogo'; END IF;

  v_resultante := v_stock.cantidad + p_delta;
  IF v_resultante < 0 THEN
    SELECT nombre INTO v_nombre FROM inventario WHERE id = p_material_id;
    RAISE EXCEPTION 'Stock insuficiente para "%": disponible %, requerido %', v_nombre, v_stock.cantidad, abs(p_delta);
  END IF;

  v_costo := coalesce(p_costo, v_stock.costo_promedio);

  -- Costo promedio ponderado sólo en entradas valorizadas
  IF p_delta > 0 AND p_costo IS NOT NULL AND p_tipo IN ('entrada_compra','entrada_devolucion','traslado_entrada') THEN
    v_nuevo_prom := CASE WHEN v_resultante > 0
      THEN ((v_stock.cantidad * v_stock.costo_promedio) + (p_delta * p_costo)) / v_resultante
      ELSE p_costo END;
  ELSE
    v_nuevo_prom := v_stock.costo_promedio;
  END IF;

  -- Lógica FEFO automática cuando hay salida sin lote específico
  IF p_delta < 0 AND v_lote_id IS NULL THEN
    v_restante := abs(p_delta);
    FOR v_lote IN
      SELECT id, numero_lote, fecha_vencimiento, cantidad_disponible
      FROM lotes_farmacia
      WHERE farmacia_id = p_farmacia_id
        AND material_id = p_material_id
        AND estado = 'disponible'
        AND cantidad_disponible > 0
      ORDER BY fecha_vencimiento ASC NULLS LAST, created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_restante <= 0;
      v_descontar := LEAST(v_lote.cantidad_disponible, v_restante);
      UPDATE lotes_farmacia
         SET cantidad_disponible = cantidad_disponible - v_descontar,
             estado = CASE WHEN cantidad_disponible - v_descontar <= 0 THEN 'agotado' ELSE estado END,
             updated_at = now()
       WHERE id = v_lote.id;

      IF v_lote_id IS NULL THEN
        v_lote_id := v_lote.id;
        v_num_lote := v_lote.numero_lote;
        v_f_vto := v_lote.fecha_vencimiento;
      END IF;
      v_restante := v_restante - v_descontar;
    END LOOP;
  END IF;

  -- Completar snapshot de lote si llegó p_lote_id sin texto
  IF v_lote_id IS NOT NULL AND v_num_lote IS NULL THEN
    SELECT numero_lote, fecha_vencimiento INTO v_num_lote, v_f_vto
    FROM lotes_farmacia WHERE id = v_lote_id;
  END IF;

  UPDATE stock_farmacia
     SET cantidad = v_resultante,
         costo_promedio = round(v_nuevo_prom, 2),
         updated_at = now()
   WHERE id = v_stock.id;

  INSERT INTO movimientos_farmacia (
    farmacia_id, material_id, tipo, cantidad, stock_anterior, stock_resultante,
    costo_unitario, valor_total, solicitud_id, devolucion_id, area_id,
    motivo, proveedor, documento_referencia,
    lote_id, recepcion_id, numero_lote, fecha_vencimiento, usuario_id
  ) VALUES (
    p_farmacia_id, p_material_id, p_tipo, abs(p_delta), v_stock.cantidad, v_resultante,
    round(v_costo, 2), round(abs(p_delta) * v_costo, 2), p_solicitud_id, p_devolucion_id, p_area_id,
    NULLIF(trim(coalesce(p_motivo,'')), ''), NULLIF(trim(coalesce(p_proveedor,'')), ''), NULLIF(trim(coalesce(p_documento,'')), ''),
    v_lote_id, p_recepcion_id, v_num_lote, v_f_vto, auth.uid()
  );

  RETURN round(v_costo, 2);
END $$;

-- Mantener retrocompatibilidad exacta con fn_mover_stock(11 args) delegando a fn_mover_stock_lote
CREATE OR REPLACE FUNCTION fn_mover_stock(
  p_farmacia_id UUID, p_material_id UUID, p_delta NUMERIC, p_tipo mov_farmacia_tipo,
  p_costo NUMERIC, p_solicitud_id UUID, p_devolucion_id UUID, p_area_id UUID,
  p_motivo TEXT, p_proveedor TEXT, p_documento TEXT
) RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN fn_mover_stock_lote(
    p_farmacia_id, p_material_id, p_delta, p_tipo,
    p_costo, p_solicitud_id, p_devolucion_id, p_area_id,
    p_motivo, p_proveedor, p_documento,
    NULL, NULL, NULL, NULL
  );
END $$;

REVOKE EXECUTE ON FUNCTION fn_mover_stock_lote(UUID, UUID, NUMERIC, mov_farmacia_tipo, NUMERIC, UUID, UUID, UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT, DATE) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_mover_stock(UUID, UUID, NUMERIC, mov_farmacia_tipo, NUMERIC, UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- =====================================================================
-- 8. FUNCIÓN ATÓMICA: REGISTRO NORMATIVO DE ENTRADA / RECEPCIÓN TÉCNICA
-- =====================================================================
-- p_items JSONB array de objetos:
-- {
--   material_id: UUID,
--   cantidad: NUMERIC,
--   costo_unitario: NUMERIC,
--   descuento_porcentaje?: NUMERIC,
--   iva_porcentaje?: NUMERIC,
--   precio_venta_sugerido?: NUMERIC,
--   numero_lote?: TEXT,
--   fecha_vencimiento?: DATE,
--   fecha_fabricacion?: DATE,
--   codigo_barras?: TEXT,
--   registro_sanitario?: TEXT,
--   laboratorio_fabricante?: TEXT,
--   presentacion?: TEXT,
--   condiciones_almacenamiento?: TEXT,
--   cumple_especificaciones?: BOOLEAN,
--   estado_recepcion?: 'disponible' | 'cuarentena' | 'rechazado',
--   actualizar_catalogo?: BOOLEAN,
--   observaciones?: TEXT
-- }
CREATE OR REPLACE FUNCTION fn_registrar_recepcion_normativa(
  p_farmacia_id UUID,
  p_proveedor_id UUID,
  p_proveedor_nombre TEXT,
  p_proveedor_nit TEXT,
  p_tipo_documento TEXT,
  p_numero_documento TEXT,
  p_fecha_documento DATE,
  p_temperatura NUMERIC,
  p_humedad NUMERIC,
  p_condiciones_empaque_ok BOOLEAN,
  p_cadena_frio_ok BOOLEAN,
  p_dictamen_tecnico TEXT,
  p_observaciones TEXT,
  p_items JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_radicado TEXT;
  v_recepcion_id UUID;
  v_prov_nombre TEXT := NULLIF(trim(coalesce(p_proveedor_nombre, '')), '');
  v_prov_nit TEXT := NULLIF(trim(coalesce(p_proveedor_nit, '')), '');
  v_tipo_doc TEXT := coalesce(NULLIF(trim(coalesce(p_tipo_documento, '')), ''), 'factura');
  v_dictamen TEXT := coalesce(NULLIF(trim(coalesce(p_dictamen_tecnico, '')), ''), 'aprobado');
  v_x RECORD;
  v_mat RECORD;
  v_lote_id UUID;
  v_num_lote TEXT;
  v_estado_item TEXT;
  v_alm TEXT;
  v_sub NUMERIC;
  v_desc NUMERIC;
  v_base_iva NUMERIC;
  v_iva NUMERIC;
  v_tot NUMERIC;
  v_costo_neto_unit NUMERIC;
  v_sum_sub NUMERIC := 0;
  v_sum_desc NUMERIC := 0;
  v_sum_iva NUMERIC := 0;
  v_sum_tot NUMERIC := 0;
  v_count INTEGER := 0;
  v_barcode TEXT;
  v_reg_san TEXT;
  v_fab TEXT;
  v_pres TEXT;
  v_motivo_kardex TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF NOT fn_en_farmacia(p_farmacia_id) THEN RAISE EXCEPTION 'No tiene permiso en esta farmacia'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Debe agregar al menos un insumo a la recepción';
  END IF;

  IF v_tipo_doc NOT IN ('factura','remision','orden_compra','donacion','traslado','otro') THEN
    RAISE EXCEPTION 'Tipo de documento inválido';
  END IF;
  IF v_dictamen NOT IN ('aprobado','aprobado_con_observaciones','cuarentena','rechazado') THEN
    RAISE EXCEPTION 'Dictamen técnico inválido';
  END IF;

  -- Resolver snapshot del proveedor si se eligió del catálogo
  IF p_proveedor_id IS NOT NULL THEN
    SELECT razon_social, nit INTO v_prov_nombre, v_prov_nit
    FROM proveedores WHERE id = p_proveedor_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Proveedor seleccionado no existe'; END IF;
  END IF;

  v_radicado := fn_next_radicado('REC');

  INSERT INTO recepciones_farmacia (
    radicado, farmacia_id, proveedor_id, proveedor_nombre, proveedor_nit,
    tipo_documento, numero_documento, fecha_documento,
    temperatura_recepcion, humedad_recepcion,
    condiciones_empaque_ok, cadena_frio_ok, dictamen_tecnico,
    observaciones, recibido_por
  ) VALUES (
    v_radicado, p_farmacia_id, p_proveedor_id, v_prov_nombre, v_prov_nit,
    v_tipo_doc, NULLIF(trim(coalesce(p_numero_documento, '')), ''), p_fecha_documento,
    p_temperatura, p_humedad,
    coalesce(p_condiciones_empaque_ok, true), coalesce(p_cadena_frio_ok, true), v_dictamen,
    NULLIF(trim(coalesce(p_observaciones, '')), ''), v_uid
  ) RETURNING id INTO v_recepcion_id;

  FOR v_x IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(
      material_id UUID,
      cantidad NUMERIC,
      costo_unitario NUMERIC,
      descuento_porcentaje NUMERIC,
      iva_porcentaje NUMERIC,
      precio_venta_sugerido NUMERIC,
      numero_lote TEXT,
      fecha_vencimiento DATE,
      fecha_fabricacion DATE,
      codigo_barras TEXT,
      registro_sanitario TEXT,
      laboratorio_fabricante TEXT,
      presentacion TEXT,
      condiciones_almacenamiento TEXT,
      cumple_especificaciones BOOLEAN,
      estado_recepcion TEXT,
      actualizar_catalogo BOOLEAN,
      observaciones TEXT
    )
  LOOP
    IF v_x.material_id IS NULL THEN RAISE EXCEPTION 'Uno de los ítems no tiene insumo seleccionado'; END IF;
    IF v_x.cantidad IS NULL OR v_x.cantidad <= 0 THEN RAISE EXCEPTION 'Todas las cantidades deben ser mayores a cero'; END IF;
    IF v_x.costo_unitario IS NULL OR v_x.costo_unitario < 0 THEN RAISE EXCEPTION 'El costo unitario no puede ser negativo'; END IF;

    SELECT id, nombre, codigo_barras, registro_sanitario, laboratorio_fabricante,
           presentacion_comercial, condiciones_almacenamiento, requiere_lote, requiere_vencimiento
      INTO v_mat
      FROM inventario WHERE id = v_x.material_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'Insumo no encontrado en el catálogo'; END IF;

    v_num_lote := NULLIF(trim(coalesce(v_x.numero_lote, '')), '');
    IF v_num_lote IS NULL THEN
      IF coalesce(v_mat.requiere_lote, true) THEN
        RAISE EXCEPTION 'El insumo "%" requiere número de lote', v_mat.nombre;
      END IF;
      v_num_lote := 'SIN-LOTE';
    END IF;

    IF v_x.fecha_vencimiento IS NULL AND coalesce(v_mat.requiere_vencimiento, true) THEN
      RAISE EXCEPTION 'El insumo "%" requiere fecha de vencimiento', v_mat.nombre;
    END IF;

    IF v_x.fecha_fabricacion IS NOT NULL AND v_x.fecha_vencimiento IS NOT NULL
       AND v_x.fecha_vencimiento <= v_x.fecha_fabricacion THEN
      RAISE EXCEPTION 'La fecha de vencimiento debe ser posterior a la fecha de fabricación para "%"', v_mat.nombre;
    END IF;

    -- Determinar estado normativo del lote
    v_estado_item := coalesce(NULLIF(trim(coalesce(v_x.estado_recepcion, '')), ''), 'disponible');
    IF v_dictamen = 'rechazado' THEN
      v_estado_item := 'rechazado';
    ELSIF v_dictamen = 'cuarentena' OR coalesce(v_x.cumple_especificaciones, true) = false THEN
      v_estado_item := 'cuarentena';
    END IF;

    -- Bloquear ingreso como disponible si ya está vencido
    IF v_x.fecha_vencimiento IS NOT NULL AND v_x.fecha_vencimiento < CURRENT_DATE AND v_estado_item = 'disponible' THEN
      RAISE EXCEPTION 'El insumo "%" (Lote %) está vencido (%). Solo puede ingresarse en cuarentena o rechazado.',
        v_mat.nombre, v_num_lote, to_char(v_x.fecha_vencimiento, 'DD/MM/YYYY');
    END IF;

    v_alm := coalesce(NULLIF(trim(coalesce(v_x.condiciones_almacenamiento, '')), ''), v_mat.condiciones_almacenamiento, 'ambiente');
    IF v_alm NOT IN ('ambiente','refrigerado','congelado','protegido_luz','controlado') THEN
      v_alm := 'ambiente';
    END IF;

    v_barcode := NULLIF(trim(coalesce(v_x.codigo_barras, '')), '');
    v_reg_san := coalesce(NULLIF(trim(coalesce(v_x.registro_sanitario, '')), ''), v_mat.registro_sanitario);
    v_fab     := coalesce(NULLIF(trim(coalesce(v_x.laboratorio_fabricante, '')), ''), v_mat.laboratorio_fabricante);
    v_pres    := coalesce(NULLIF(trim(coalesce(v_x.presentacion, '')), ''), v_mat.presentacion_comercial);

    -- Cálculos financieros exactos
    v_sub := round(v_x.cantidad * v_x.costo_unitario, 2);
    v_desc := round(v_sub * (greatest(coalesce(v_x.descuento_porcentaje, 0), 0) / 100.0), 2);
    v_base_iva := greatest(v_sub - v_desc, 0);
    v_iva := round(v_base_iva * (greatest(coalesce(v_x.iva_porcentaje, 0), 0) / 100.0), 2);
    v_tot := round(v_base_iva + v_iva, 2);
    v_costo_neto_unit := round(v_tot / v_x.cantidad, 2);

    v_sum_sub := v_sum_sub + v_sub;
    v_sum_desc := v_sum_desc + v_desc;
    v_sum_iva := v_sum_iva + v_iva;
    v_sum_tot := v_sum_tot + v_tot;

    -- Actualizar ficha maestra del catálogo si el usuario lo solicitó o si faltaban datos normativos
    IF coalesce(v_x.actualizar_catalogo, true) THEN
      UPDATE inventario
         SET codigo_barras = CASE
               WHEN v_barcode IS NOT NULL AND (codigo_barras IS NULL OR trim(codigo_barras) = '')
                    AND NOT EXISTS (SELECT 1 FROM inventario i2 WHERE i2.codigo_barras = v_barcode AND i2.id <> v_x.material_id)
               THEN v_barcode ELSE codigo_barras END,
             registro_sanitario = coalesce(NULLIF(trim(coalesce(v_x.registro_sanitario, '')), ''), registro_sanitario),
             laboratorio_fabricante = coalesce(NULLIF(trim(coalesce(v_x.laboratorio_fabricante, '')), ''), laboratorio_fabricante),
             presentacion_comercial = coalesce(NULLIF(trim(coalesce(v_x.presentacion, '')), ''), presentacion_comercial),
             condiciones_almacenamiento = v_alm,
             iva_porcentaje = coalesce(v_x.iva_porcentaje, iva_porcentaje),
             precio_venta_referencia = CASE
               WHEN v_x.precio_venta_sugerido IS NOT NULL AND v_x.precio_venta_sugerido > 0
               THEN v_x.precio_venta_sugerido ELSE precio_venta_referencia END,
             updated_at = now()
       WHERE id = v_x.material_id;
    END IF;

    v_lote_id := NULL;
    IF v_estado_item <> 'rechazado' THEN
      -- Buscar si ya existe un lote idéntico activo/cuarentena en esta farmacia
      SELECT id INTO v_lote_id
      FROM lotes_farmacia
      WHERE farmacia_id = p_farmacia_id
        AND material_id = v_x.material_id
        AND upper(trim(numero_lote)) = upper(trim(v_num_lote))
        AND coalesce(fecha_vencimiento, DATE '9999-12-31') = coalesce(v_x.fecha_vencimiento, DATE '9999-12-31')
        AND estado = v_estado_item
      LIMIT 1
      FOR UPDATE;

      IF v_lote_id IS NOT NULL THEN
        UPDATE lotes_farmacia
           SET cantidad_inicial = cantidad_inicial + v_x.cantidad,
               cantidad_disponible = cantidad_disponible + v_x.cantidad,
               costo_unitario = v_costo_neto_unit,
               iva_porcentaje = coalesce(v_x.iva_porcentaje, iva_porcentaje),
               precio_venta_sugerido = coalesce(v_x.precio_venta_sugerido, precio_venta_sugerido),
               codigo_barras = coalesce(v_barcode, codigo_barras),
               registro_sanitario = coalesce(v_reg_san, registro_sanitario),
               laboratorio_fabricante = coalesce(v_fab, laboratorio_fabricante),
               presentacion = coalesce(v_pres, presentacion),
               updated_at = now()
         WHERE id = v_lote_id;
      ELSE
        INSERT INTO lotes_farmacia (
          farmacia_id, material_id, numero_lote, fecha_vencimiento, fecha_fabricacion,
          codigo_barras, registro_sanitario, laboratorio_fabricante, presentacion,
          condiciones_almacenamiento, proveedor_id, proveedor_nombre, recepcion_id,
          cantidad_inicial, cantidad_disponible, costo_unitario, iva_porcentaje,
          precio_venta_sugerido, estado, observaciones
        ) VALUES (
          p_farmacia_id, v_x.material_id, upper(trim(v_num_lote)), v_x.fecha_vencimiento, v_x.fecha_fabricacion,
          coalesce(v_barcode, v_mat.codigo_barras), v_reg_san, v_fab, v_pres,
          v_alm, p_proveedor_id, v_prov_nombre, v_recepcion_id,
          v_x.cantidad, v_x.cantidad, v_costo_neto_unit, coalesce(v_x.iva_porcentaje, 0),
          v_x.precio_venta_sugerido, v_estado_item, NULLIF(trim(coalesce(v_x.observaciones, '')), '')
        ) RETURNING id INTO v_lote_id;
      END IF;
    END IF;

    INSERT INTO recepcion_items (
      recepcion_id, material_id, lote_id, numero_lote, fecha_vencimiento, fecha_fabricacion,
      codigo_barras, registro_sanitario, laboratorio_fabricante, presentacion,
      cantidad, costo_unitario, descuento_porcentaje, iva_porcentaje,
      subtotal, valor_descuento, valor_iva, valor_total, precio_venta_sugerido,
      cumple_especificaciones, condiciones_almacenamiento, estado_recepcion, observaciones
    ) VALUES (
      v_recepcion_id, v_x.material_id, v_lote_id, upper(trim(v_num_lote)), v_x.fecha_vencimiento, v_x.fecha_fabricacion,
      coalesce(v_barcode, v_mat.codigo_barras), v_reg_san, v_fab, v_pres,
      v_x.cantidad, v_x.costo_unitario, coalesce(v_x.descuento_porcentaje, 0), coalesce(v_x.iva_porcentaje, 0),
      v_sub, v_desc, v_iva, v_tot, v_x.precio_venta_sugerido,
      coalesce(v_x.cumple_especificaciones, true), v_alm, v_estado_item,
      NULLIF(trim(coalesce(v_x.observaciones, '')), '')
    );

    -- Sólo los ítems aprobados como 'disponible' ingresan inmediatamente al stock usable y Kardex
    IF v_estado_item = 'disponible' THEN
      v_motivo_kardex := 'Recepción ' || v_radicado || ' | Lote: ' || upper(trim(v_num_lote))
        || CASE WHEN v_x.fecha_vencimiento IS NOT NULL THEN ' | Vto: ' || to_char(v_x.fecha_vencimiento, 'DD/MM/YYYY') ELSE '' END
        || CASE WHEN NULLIF(trim(coalesce(p_observaciones,'')), '') IS NOT NULL THEN ' — ' || trim(p_observaciones) ELSE '' END;

      PERFORM fn_mover_stock_lote(
        p_farmacia_id, v_x.material_id, v_x.cantidad, 'entrada_compra',
        v_costo_neto_unit, NULL, NULL, NULL,
        v_motivo_kardex, v_prov_nombre, coalesce(NULLIF(trim(coalesce(p_numero_documento, '')), ''), v_radicado),
        v_lote_id, v_recepcion_id, upper(trim(v_num_lote)), v_x.fecha_vencimiento
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  UPDATE recepciones_farmacia
     SET subtotal = v_sum_sub,
         descuento_total = v_sum_desc,
         iva_total = v_sum_iva,
         valor_total = v_sum_tot
   WHERE id = v_recepcion_id;

  RETURN jsonb_build_object(
    'id', v_recepcion_id,
    'radicado', v_radicado,
    'items_count', v_count,
    'valor_total', v_sum_tot
  );
END $$;

-- =====================================================================
-- 9. FUNCIÓN ATÓMICA: CAMBIAR ESTADO DE LOTE (CUARENTENA / LIBERACIÓN / RETIRO)
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_cambiar_estado_lote(
  p_lote_id UUID,
  p_nuevo_estado TEXT,
  p_motivo TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lote lotes_farmacia%ROWTYPE;
  v_motivo TEXT := trim(coalesce(p_motivo, ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF v_motivo = '' THEN RAISE EXCEPTION 'Debe indicar el motivo técnico del cambio de estado'; END IF;
  IF p_nuevo_estado NOT IN ('disponible','cuarentena','vencido','retirado') THEN
    RAISE EXCEPTION 'Estado de lote inválido';
  END IF;

  SELECT * INTO v_lote FROM lotes_farmacia WHERE id = p_lote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote no encontrado'; END IF;
  IF NOT fn_en_farmacia(v_lote.farmacia_id) THEN RAISE EXCEPTION 'No tiene permiso en esta farmacia'; END IF;
  IF v_lote.estado = p_nuevo_estado THEN RAISE EXCEPTION 'El lote ya se encuentra en estado "%"', p_nuevo_estado; END IF;
  IF v_lote.estado IN ('retirado','agotado') THEN
    RAISE EXCEPTION 'Un lote en estado "%" no puede cambiar de estado', v_lote.estado;
  END IF;
  IF v_lote.estado = 'vencido' AND p_nuevo_estado <> 'retirado' THEN
    RAISE EXCEPTION 'Un lote vencido solo puede pasar a estado retirado';
  END IF;
  IF v_lote.cantidad_disponible <= 0 THEN RAISE EXCEPTION 'El lote no tiene saldo disponible para cambiar de estado'; END IF;

  IF p_nuevo_estado = 'disponible' AND v_lote.fecha_vencimiento IS NOT NULL AND v_lote.fecha_vencimiento < CURRENT_DATE THEN
    RAISE EXCEPTION 'No se puede liberar a disponible un lote cuya fecha de vencimiento (%) ya pasó', to_char(v_lote.fecha_vencimiento, 'DD/MM/YYYY');
  END IF;

  -- Si sale de 'disponible' hacia cuarentena/vencido/retirado -> descontar del stock utilizable
  IF v_lote.estado = 'disponible' AND p_nuevo_estado <> 'disponible' THEN
    PERFORM fn_mover_stock_lote(
      v_lote.farmacia_id, v_lote.material_id, -v_lote.cantidad_disponible, 'ajuste_negativo',
      v_lote.costo_unitario, NULL, NULL, NULL,
      'Lote ' || v_lote.numero_lote || ' pasado a ' || upper(p_nuevo_estado) || ': ' || v_motivo,
      v_lote.proveedor_nombre, v_lote.numero_lote,
      v_lote.id, v_lote.recepcion_id, v_lote.numero_lote, v_lote.fecha_vencimiento
    );
  -- Si entra a 'disponible' desde cuarentena -> sumar al stock utilizable
  ELSIF v_lote.estado = 'cuarentena' AND p_nuevo_estado = 'disponible' THEN
    PERFORM fn_mover_stock_lote(
      v_lote.farmacia_id, v_lote.material_id, v_lote.cantidad_disponible, 'ajuste_positivo',
      v_lote.costo_unitario, NULL, NULL, NULL,
      'Liberación de cuarentena Lote ' || v_lote.numero_lote || ': ' || v_motivo,
      v_lote.proveedor_nombre, v_lote.numero_lote,
      v_lote.id, v_lote.recepcion_id, v_lote.numero_lote, v_lote.fecha_vencimiento
    );
  END IF;

  UPDATE lotes_farmacia
     SET estado = p_nuevo_estado,
         observaciones = coalesce(observaciones || E'\n', '') || '[' || to_char(now(), 'DD/MM/YYYY HH24:MI') || '] ' || upper(p_nuevo_estado) || ': ' || v_motivo,
         updated_at = now()
   WHERE id = v_lote.id;
END $$;

-- =====================================================================
-- 10. ROW LEVEL SECURITY
-- =====================================================================
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE recepciones_farmacia ENABLE ROW LEVEL SECURITY;
ALTER TABLE recepcion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes_farmacia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proveedores_select" ON proveedores;
CREATE POLICY "proveedores_select" ON proveedores FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "proveedores_manage" ON proveedores;
CREATE POLICY "proveedores_manage" ON proveedores FOR ALL TO authenticated
  USING (get_current_user_role() IN ('admin','farmacia'))
  WITH CHECK (get_current_user_role() IN ('admin','farmacia'));

DROP POLICY IF EXISTS "recepciones_farmacia_select" ON recepciones_farmacia;
CREATE POLICY "recepciones_farmacia_select" ON recepciones_farmacia FOR SELECT TO authenticated
  USING (fn_en_farmacia(farmacia_id));

DROP POLICY IF EXISTS "recepcion_items_select" ON recepcion_items;
CREATE POLICY "recepcion_items_select" ON recepcion_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM recepciones_farmacia r WHERE r.id = recepcion_id AND fn_en_farmacia(r.farmacia_id)));

DROP POLICY IF EXISTS "lotes_farmacia_select" ON lotes_farmacia;
CREATE POLICY "lotes_farmacia_select" ON lotes_farmacia FOR SELECT TO authenticated
  USING (true);

-- Recargar esquema de PostgREST
NOTIFY pgrst, 'reload schema';
