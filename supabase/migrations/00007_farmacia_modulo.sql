-- supabase/migrations/00007_farmacia_modulo.sql
-- Módulo Farmacia — Paso 2 de 2
-- Solicitudes de insumos de áreas a farmacias, despachos, recepciones, devoluciones,
-- stock por farmacia, kardex inmutable e indicadores.
-- Requiere haber ejecutado antes 00006_farmacia_roles.sql

-- =====================================================================
-- 1. ENUMS
-- =====================================================================
DO $$ BEGIN
  CREATE TYPE solicitud_estado AS ENUM ('borrador','enviada','aprobada','rechazada','despachada_parcial','despachada','recibida','cerrada','anulada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE solicitud_tipo AS ENUM ('puntual','semanal','mensual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE solicitud_prioridad AS ENUM ('normal','urgente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE devolucion_estado AS ENUM ('pendiente','confirmada','rechazada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE devolucion_motivo AS ENUM ('no_utilizado','vencido','defectuoso','error_despacho','otro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mov_farmacia_tipo AS ENUM ('entrada_compra','salida_despacho','entrada_devolucion','ajuste_positivo','ajuste_negativo','traslado_entrada','traslado_salida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- 2. TABLAS
-- =====================================================================
CREATE TABLE IF NOT EXISTS areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    nombre TEXT UNIQUE NOT NULL,
    centro_costo TEXT,
    descripcion TEXT,
    responsable_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    activa BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farmacias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    nombre TEXT UNIQUE NOT NULL,
    ubicacion TEXT,
    descripcion TEXT,
    responsable_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    activa BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuario_areas (
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, area_id)
);

CREATE TABLE IF NOT EXISTS usuario_farmacias (
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    farmacia_id UUID NOT NULL REFERENCES farmacias(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, farmacia_id)
);

CREATE TABLE IF NOT EXISTS stock_farmacia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmacia_id UUID NOT NULL REFERENCES farmacias(id) ON DELETE RESTRICT,
    material_id UUID NOT NULL REFERENCES inventario(id) ON DELETE RESTRICT,
    cantidad NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    stock_minimo NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    stock_maximo NUMERIC(12,2) CHECK (stock_maximo IS NULL OR stock_maximo >= 0),
    costo_promedio NUMERIC(12,2) NOT NULL DEFAULT 0,
    lote_id UUID, -- Reservado para control futuro de lotes / vencimientos
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (farmacia_id, material_id)
);

CREATE TABLE IF NOT EXISTS solicitudes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    radicado TEXT UNIQUE NOT NULL,
    area_id UUID NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
    farmacia_id UUID NOT NULL REFERENCES farmacias(id) ON DELETE RESTRICT,
    tipo solicitud_tipo NOT NULL DEFAULT 'puntual',
    prioridad solicitud_prioridad NOT NULL DEFAULT 'normal',
    periodo_inicio DATE,
    periodo_fin DATE,
    estado solicitud_estado NOT NULL DEFAULT 'borrador',
    observaciones TEXT,
    motivo_rechazo TEXT,
    motivo_anulacion TEXT,
    observaciones_recepcion TEXT,
    con_novedad BOOLEAN NOT NULL DEFAULT false,
    valor_despachado NUMERIC(14,2) NOT NULL DEFAULT 0,
    valor_devuelto NUMERIC(14,2) NOT NULL DEFAULT 0,
    creado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    solicitado_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_solicitud TIMESTAMPTZ,
    aprobado_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_aprobacion TIMESTAMPTZ,
    despachado_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_despacho TIMESTAMPTZ,
    fecha_ultimo_despacho TIMESTAMPTZ,
    recibido_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_recepcion TIMESTAMPTZ,
    cerrado_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_cierre TIMESTAMPTZ,
    anulado_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_anulacion TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_periodo CHECK (periodo_fin IS NULL OR periodo_inicio IS NULL OR periodo_fin >= periodo_inicio)
);
CREATE INDEX IF NOT EXISTS idx_solicitudes_area ON solicitudes(area_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_farmacia ON solicitudes(farmacia_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_created ON solicitudes(created_at DESC);

CREATE TABLE IF NOT EXISTS solicitud_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id UUID NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES inventario(id) ON DELETE RESTRICT,
    cantidad_solicitada NUMERIC(12,2) NOT NULL CHECK (cantidad_solicitada > 0),
    cantidad_aprobada NUMERIC(12,2) CHECK (cantidad_aprobada IS NULL OR cantidad_aprobada >= 0),
    cantidad_despachada NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cantidad_despachada >= 0),
    cantidad_recibida NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cantidad_recibida >= 0),
    cantidad_devuelta NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cantidad_devuelta >= 0),
    costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
    observaciones TEXT,
    lote_id UUID, -- Reservado para control futuro de lotes / vencimientos
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (solicitud_id, material_id)
);
CREATE INDEX IF NOT EXISTS idx_solicitud_items_sol ON solicitud_items(solicitud_id);

CREATE TABLE IF NOT EXISTS solicitud_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id UUID NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
    accion TEXT NOT NULL,
    estado_anterior solicitud_estado,
    estado_nuevo solicitud_estado,
    comentario TEXT,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_solicitud_eventos_sol ON solicitud_eventos(solicitud_id);

CREATE TABLE IF NOT EXISTS devoluciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    radicado TEXT UNIQUE NOT NULL,
    solicitud_id UUID NOT NULL REFERENCES solicitudes(id) ON DELETE RESTRICT,
    area_id UUID NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
    farmacia_id UUID NOT NULL REFERENCES farmacias(id) ON DELETE RESTRICT,
    estado devolucion_estado NOT NULL DEFAULT 'pendiente',
    motivo devolucion_motivo NOT NULL,
    detalle TEXT,
    observaciones_farmacia TEXT,
    valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    devuelto_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_devolucion TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmado_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_confirmacion TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_devoluciones_sol ON devoluciones(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_devoluciones_estado ON devoluciones(estado);

CREATE TABLE IF NOT EXISTS devolucion_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    devolucion_id UUID NOT NULL REFERENCES devoluciones(id) ON DELETE CASCADE,
    solicitud_item_id UUID NOT NULL REFERENCES solicitud_items(id) ON DELETE RESTRICT,
    material_id UUID NOT NULL REFERENCES inventario(id) ON DELETE RESTRICT,
    cantidad NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
    cantidad_aceptada NUMERIC(12,2) CHECK (cantidad_aceptada IS NULL OR cantidad_aceptada >= 0),
    costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
    observaciones TEXT,
    lote_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_devolucion_items_dev ON devolucion_items(devolucion_id);

CREATE TABLE IF NOT EXISTS movimientos_farmacia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmacia_id UUID NOT NULL REFERENCES farmacias(id) ON DELETE RESTRICT,
    material_id UUID NOT NULL REFERENCES inventario(id) ON DELETE RESTRICT,
    tipo mov_farmacia_tipo NOT NULL,
    cantidad NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
    stock_anterior NUMERIC(12,2) NOT NULL,
    stock_resultante NUMERIC(12,2) NOT NULL,
    costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
    valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    solicitud_id UUID REFERENCES solicitudes(id) ON DELETE RESTRICT,
    devolucion_id UUID REFERENCES devoluciones(id) ON DELETE RESTRICT,
    area_id UUID REFERENCES areas(id) ON DELETE RESTRICT,
    documento_referencia TEXT,
    proveedor TEXT,
    motivo TEXT,
    lote_id UUID,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mov_farm_farmacia ON movimientos_farmacia(farmacia_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mov_farm_material ON movimientos_farmacia(material_id);
CREATE INDEX IF NOT EXISTS idx_mov_farm_area ON movimientos_farmacia(area_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mov_farm_tipo ON movimientos_farmacia(tipo);

-- Kardex y eventos inmutables
CREATE OR REPLACE FUNCTION fn_bloquear_modificacion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Los registros de auditoría no se pueden modificar ni eliminar';
END $$;

DROP TRIGGER IF EXISTS trg_mov_farmacia_inmutable ON movimientos_farmacia;
CREATE TRIGGER trg_mov_farmacia_inmutable BEFORE UPDATE OR DELETE ON movimientos_farmacia
FOR EACH ROW EXECUTE FUNCTION fn_bloquear_modificacion();

DROP TRIGGER IF EXISTS trg_sol_eventos_inmutable ON solicitud_eventos;
CREATE TRIGGER trg_sol_eventos_inmutable BEFORE UPDATE OR DELETE ON solicitud_eventos
FOR EACH ROW EXECUTE FUNCTION fn_bloquear_modificacion();

-- =====================================================================
-- 3. HELPERS DE PERMISOS
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_es_admin() RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin' AND activo = true);
$$;

CREATE OR REPLACE FUNCTION fn_en_area(p_area_id UUID) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT fn_es_admin() OR EXISTS (SELECT 1 FROM usuario_areas WHERE usuario_id = auth.uid() AND area_id = p_area_id);
$$;

CREATE OR REPLACE FUNCTION fn_en_farmacia(p_farmacia_id UUID) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT fn_es_admin() OR EXISTS (SELECT 1 FROM usuario_farmacias WHERE usuario_id = auth.uid() AND farmacia_id = p_farmacia_id);
$$;

-- =====================================================================
-- 4. HELPERS INTERNOS (no expuestos a usuarios)
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_next_radicado(p_prefijo TEXT) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key TEXT;
  v_val INTEGER;
BEGIN
  v_key := p_prefijo || '-' || to_char(CURRENT_DATE, 'YYYY');
  INSERT INTO custom_sequences (sequence_key, last_value) VALUES (v_key, 0)
  ON CONFLICT (sequence_key) DO NOTHING;
  UPDATE custom_sequences SET last_value = last_value + 1
  WHERE sequence_key = v_key RETURNING last_value INTO v_val;
  RETURN v_key || '-' || LPAD(v_val::TEXT, 4, '0');
END $$;

CREATE OR REPLACE FUNCTION fn_evento_solicitud(
  p_solicitud_id UUID, p_accion TEXT, p_anterior solicitud_estado, p_nuevo solicitud_estado, p_comentario TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO solicitud_eventos (solicitud_id, accion, estado_anterior, estado_nuevo, comentario, usuario_id)
  VALUES (p_solicitud_id, p_accion, p_anterior, p_nuevo, NULLIF(trim(coalesce(p_comentario,'')), ''), auth.uid());
END $$;

-- Mueve stock de forma atómica (bloqueo de fila), registra kardex y devuelve el costo unitario aplicado.
CREATE OR REPLACE FUNCTION fn_mover_stock(
  p_farmacia_id UUID, p_material_id UUID, p_delta NUMERIC, p_tipo mov_farmacia_tipo,
  p_costo NUMERIC, p_solicitud_id UUID, p_devolucion_id UUID, p_area_id UUID,
  p_motivo TEXT, p_proveedor TEXT, p_documento TEXT
) RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stock stock_farmacia%ROWTYPE;
  v_resultante NUMERIC;
  v_costo NUMERIC;
  v_nuevo_prom NUMERIC;
  v_nombre TEXT;
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

  UPDATE stock_farmacia
     SET cantidad = v_resultante, costo_promedio = round(v_nuevo_prom, 2), updated_at = now()
   WHERE id = v_stock.id;

  INSERT INTO movimientos_farmacia (
    farmacia_id, material_id, tipo, cantidad, stock_anterior, stock_resultante,
    costo_unitario, valor_total, solicitud_id, devolucion_id, area_id,
    motivo, proveedor, documento_referencia, usuario_id
  ) VALUES (
    p_farmacia_id, p_material_id, p_tipo, abs(p_delta), v_stock.cantidad, v_resultante,
    round(v_costo, 2), round(abs(p_delta) * v_costo, 2), p_solicitud_id, p_devolucion_id, p_area_id,
    NULLIF(trim(coalesce(p_motivo,'')), ''), NULLIF(trim(coalesce(p_proveedor,'')), ''), NULLIF(trim(coalesce(p_documento,'')), ''), auth.uid()
  );

  RETURN round(v_costo, 2);
END $$;

REVOKE EXECUTE ON FUNCTION fn_next_radicado(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_evento_solicitud(UUID, TEXT, solicitud_estado, solicitud_estado, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_mover_stock(UUID, UUID, NUMERIC, mov_farmacia_tipo, NUMERIC, UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- =====================================================================
-- 5. FUNCIONES DE NEGOCIO — SOLICITUDES
-- =====================================================================

-- Crea o edita (si está en borrador) una solicitud. p_items: [{material_id, cantidad, observaciones}]
CREATE OR REPLACE FUNCTION fn_guardar_solicitud(
  p_solicitud_id UUID, p_area_id UUID, p_farmacia_id UUID, p_tipo TEXT, p_prioridad TEXT,
  p_periodo_inicio DATE, p_periodo_fin DATE, p_observaciones TEXT, p_items JSONB, p_enviar BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
  v_radicado TEXT;
  v_sol solicitudes%ROWTYPE;
  v_item RECORD;
  v_costo NUMERIC;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF NOT fn_en_area(p_area_id) THEN RAISE EXCEPTION 'No tiene permiso para solicitar a nombre de esta área'; END IF;
  IF NOT EXISTS (SELECT 1 FROM areas WHERE id = p_area_id AND activa) THEN RAISE EXCEPTION 'El área no existe o está inactiva'; END IF;
  IF NOT EXISTS (SELECT 1 FROM farmacias WHERE id = p_farmacia_id AND activa) THEN RAISE EXCEPTION 'La farmacia no existe o está inactiva'; END IF;

  IF p_tipo NOT IN ('puntual','semanal','mensual') THEN RAISE EXCEPTION 'Tipo de solicitud inválido'; END IF;
  IF p_prioridad NOT IN ('normal','urgente') THEN RAISE EXCEPTION 'Prioridad inválida'; END IF;
  IF p_tipo <> 'puntual' AND (p_periodo_inicio IS NULL OR p_periodo_fin IS NULL) THEN
    RAISE EXCEPTION 'Las solicitudes semanales o mensuales requieren fecha de inicio y fin del periodo';
  END IF;
  IF p_periodo_inicio IS NOT NULL AND p_periodo_fin IS NOT NULL AND p_periodo_fin < p_periodo_inicio THEN
    RAISE EXCEPTION 'La fecha fin del periodo no puede ser anterior a la fecha de inicio';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Debe agregar al menos un insumo';
  END IF;
  IF (SELECT count(*) FROM jsonb_to_recordset(p_items) AS x(material_id UUID))
     <> (SELECT count(DISTINCT material_id) FROM jsonb_to_recordset(p_items) AS x(material_id UUID)) THEN
    RAISE EXCEPTION 'Hay insumos repetidos en la solicitud';
  END IF;

  IF p_solicitud_id IS NULL THEN
    v_radicado := fn_next_radicado('SOL');
    INSERT INTO solicitudes (radicado, area_id, farmacia_id, tipo, prioridad, periodo_inicio, periodo_fin, observaciones, creado_por)
    VALUES (v_radicado, p_area_id, p_farmacia_id, p_tipo::solicitud_tipo, p_prioridad::solicitud_prioridad,
            p_periodo_inicio, p_periodo_fin, NULLIF(trim(coalesce(p_observaciones,'')), ''), v_uid)
    RETURNING id INTO v_id;
    PERFORM fn_evento_solicitud(v_id, 'crear', NULL, 'borrador', NULL);
  ELSE
    SELECT * INTO v_sol FROM solicitudes WHERE id = p_solicitud_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
    IF v_sol.estado <> 'borrador' THEN RAISE EXCEPTION 'Solo se pueden editar solicitudes en borrador'; END IF;
    IF NOT fn_en_area(v_sol.area_id) THEN RAISE EXCEPTION 'No tiene permiso sobre esta solicitud'; END IF;
    v_id := v_sol.id;
    v_radicado := v_sol.radicado;
    UPDATE solicitudes SET area_id = p_area_id, farmacia_id = p_farmacia_id,
      tipo = p_tipo::solicitud_tipo, prioridad = p_prioridad::solicitud_prioridad,
      periodo_inicio = p_periodo_inicio, periodo_fin = p_periodo_fin,
      observaciones = NULLIF(trim(coalesce(p_observaciones,'')), ''), updated_at = now()
    WHERE id = v_id;
    DELETE FROM solicitud_items WHERE solicitud_id = v_id;
    PERFORM fn_evento_solicitud(v_id, 'editar', 'borrador', 'borrador', NULL);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(material_id UUID, cantidad NUMERIC, observaciones TEXT) LOOP
    IF v_item.material_id IS NULL THEN RAISE EXCEPTION 'Insumo inválido'; END IF;
    IF v_item.cantidad IS NULL OR v_item.cantidad <= 0 THEN RAISE EXCEPTION 'Todas las cantidades deben ser mayores a cero'; END IF;
    IF NOT EXISTS (SELECT 1 FROM inventario WHERE id = v_item.material_id AND coalesce(activo, true)) THEN
      RAISE EXCEPTION 'Uno de los insumos no existe o está inactivo';
    END IF;
    SELECT coalesce(sf.costo_promedio, i.precio_unitario, 0) INTO v_costo
      FROM inventario i
      LEFT JOIN stock_farmacia sf ON sf.material_id = i.id AND sf.farmacia_id = p_farmacia_id
     WHERE i.id = v_item.material_id;
    INSERT INTO solicitud_items (solicitud_id, material_id, cantidad_solicitada, costo_unitario, observaciones)
    VALUES (v_id, v_item.material_id, v_item.cantidad, coalesce(v_costo, 0), NULLIF(trim(coalesce(v_item.observaciones,'')), ''));
  END LOOP;

  IF p_enviar THEN
    UPDATE solicitudes SET estado = 'enviada', solicitado_por = v_uid, fecha_solicitud = now(), updated_at = now() WHERE id = v_id;
    PERFORM fn_evento_solicitud(v_id, 'enviar', 'borrador', 'enviada', NULL);
  END IF;

  RETURN jsonb_build_object('id', v_id, 'radicado', v_radicado);
END $$;

CREATE OR REPLACE FUNCTION fn_enviar_solicitud(p_solicitud_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sol solicitudes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_sol FROM solicitudes WHERE id = p_solicitud_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF NOT fn_en_area(v_sol.area_id) THEN RAISE EXCEPTION 'No tiene permiso sobre esta solicitud'; END IF;
  IF v_sol.estado <> 'borrador' THEN RAISE EXCEPTION 'Solo se pueden enviar solicitudes en borrador'; END IF;
  IF NOT EXISTS (SELECT 1 FROM solicitud_items WHERE solicitud_id = p_solicitud_id) THEN
    RAISE EXCEPTION 'La solicitud no tiene insumos';
  END IF;
  UPDATE solicitudes SET estado = 'enviada', solicitado_por = auth.uid(), fecha_solicitud = now(), updated_at = now()
  WHERE id = p_solicitud_id;
  PERFORM fn_evento_solicitud(p_solicitud_id, 'enviar', 'borrador', 'enviada', NULL);
END $$;

-- p_items: [{item_id, cantidad}]
CREATE OR REPLACE FUNCTION fn_aprobar_solicitud(p_solicitud_id UUID, p_items JSONB, p_comentario TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sol solicitudes%ROWTYPE;
  v_item RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_sol FROM solicitudes WHERE id = p_solicitud_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF NOT fn_en_farmacia(v_sol.farmacia_id) THEN RAISE EXCEPTION 'No tiene permiso en la farmacia de esta solicitud'; END IF;
  IF v_sol.estado <> 'enviada' THEN RAISE EXCEPTION 'Solo se pueden aprobar solicitudes enviadas'; END IF;

  IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(item_id UUID, cantidad NUMERIC) LOOP
      IF v_item.cantidad IS NULL OR v_item.cantidad < 0 THEN RAISE EXCEPTION 'Las cantidades aprobadas no pueden ser negativas'; END IF;
      UPDATE solicitud_items SET cantidad_aprobada = v_item.cantidad
       WHERE id = v_item.item_id AND solicitud_id = p_solicitud_id;
    END LOOP;
  END IF;

  UPDATE solicitud_items SET cantidad_aprobada = cantidad_solicitada
   WHERE solicitud_id = p_solicitud_id AND cantidad_aprobada IS NULL;

  IF NOT EXISTS (SELECT 1 FROM solicitud_items WHERE solicitud_id = p_solicitud_id AND cantidad_aprobada > 0) THEN
    RAISE EXCEPTION 'Todas las cantidades aprobadas son cero. Si no va a despachar nada, rechace la solicitud';
  END IF;

  UPDATE solicitudes SET estado = 'aprobada', aprobado_por = auth.uid(), fecha_aprobacion = now(), updated_at = now()
  WHERE id = p_solicitud_id;
  PERFORM fn_evento_solicitud(p_solicitud_id, 'aprobar', 'enviada', 'aprobada', p_comentario);
END $$;

CREATE OR REPLACE FUNCTION fn_rechazar_solicitud(p_solicitud_id UUID, p_motivo TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sol solicitudes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF trim(coalesce(p_motivo,'')) = '' THEN RAISE EXCEPTION 'Debe indicar el motivo del rechazo'; END IF;
  SELECT * INTO v_sol FROM solicitudes WHERE id = p_solicitud_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF NOT fn_en_farmacia(v_sol.farmacia_id) THEN RAISE EXCEPTION 'No tiene permiso en la farmacia de esta solicitud'; END IF;
  IF v_sol.estado NOT IN ('enviada','aprobada') THEN RAISE EXCEPTION 'Solo se pueden rechazar solicitudes enviadas o aprobadas sin despacho'; END IF;
  UPDATE solicitudes SET estado = 'rechazada', motivo_rechazo = trim(p_motivo), aprobado_por = auth.uid(),
         fecha_aprobacion = now(), updated_at = now()
  WHERE id = p_solicitud_id;
  PERFORM fn_evento_solicitud(p_solicitud_id, 'rechazar', v_sol.estado, 'rechazada', p_motivo);
END $$;

-- Despacho total o parcial. p_items: [{item_id, cantidad}]
CREATE OR REPLACE FUNCTION fn_despachar_solicitud(p_solicitud_id UUID, p_items JSONB, p_comentario TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sol solicitudes%ROWTYPE;
  v_x RECORD;
  v_item solicitud_items%ROWTYPE;
  v_costo NUMERIC;
  v_total NUMERIC := 0;
  v_count INTEGER := 0;
  v_nuevo solicitud_estado;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_sol FROM solicitudes WHERE id = p_solicitud_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF NOT fn_en_farmacia(v_sol.farmacia_id) THEN RAISE EXCEPTION 'No tiene permiso en la farmacia de esta solicitud'; END IF;
  IF v_sol.estado NOT IN ('enviada','aprobada','despachada_parcial') THEN
    RAISE EXCEPTION 'La solicitud en estado "%" no se puede despachar', v_sol.estado;
  END IF;

  -- Aprobación implícita si se despacha directamente desde "enviada"
  IF v_sol.estado = 'enviada' THEN
    UPDATE solicitud_items SET cantidad_aprobada = cantidad_solicitada
     WHERE solicitud_id = p_solicitud_id AND cantidad_aprobada IS NULL;
    UPDATE solicitudes SET aprobado_por = auth.uid(), fecha_aprobacion = now() WHERE id = p_solicitud_id;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'Debe indicar las cantidades a despachar'; END IF;

  FOR v_x IN SELECT * FROM jsonb_to_recordset(p_items) AS x(item_id UUID, cantidad NUMERIC) LOOP
    CONTINUE WHEN v_x.cantidad IS NULL OR v_x.cantidad = 0;
    IF v_x.cantidad < 0 THEN RAISE EXCEPTION 'Las cantidades a despachar no pueden ser negativas'; END IF;

    SELECT * INTO v_item FROM solicitud_items WHERE id = v_x.item_id AND solicitud_id = p_solicitud_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Ítem de solicitud no encontrado'; END IF;

    IF v_x.cantidad > coalesce(v_item.cantidad_aprobada, 0) - v_item.cantidad_despachada THEN
      RAISE EXCEPTION 'La cantidad a despachar (%) supera lo pendiente (%) para uno de los insumos',
        v_x.cantidad, coalesce(v_item.cantidad_aprobada, 0) - v_item.cantidad_despachada;
    END IF;

    v_costo := fn_mover_stock(v_sol.farmacia_id, v_item.material_id, -v_x.cantidad, 'salida_despacho',
                              NULL, p_solicitud_id, NULL, v_sol.area_id, 'Despacho ' || v_sol.radicado, NULL, v_sol.radicado);

    UPDATE solicitud_items
       SET costo_unitario = round(((cantidad_despachada * costo_unitario) + (v_x.cantidad * v_costo)) / (cantidad_despachada + v_x.cantidad), 2),
           cantidad_despachada = cantidad_despachada + v_x.cantidad
     WHERE id = v_item.id;

    v_total := v_total + round(v_x.cantidad * v_costo, 2);
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN RAISE EXCEPTION 'Debe despachar al menos un insumo'; END IF;

  v_nuevo := CASE WHEN EXISTS (
      SELECT 1 FROM solicitud_items WHERE solicitud_id = p_solicitud_id AND cantidad_despachada < coalesce(cantidad_aprobada, 0)
    ) THEN 'despachada_parcial'::solicitud_estado ELSE 'despachada'::solicitud_estado END;

  UPDATE solicitudes SET estado = v_nuevo, despachado_por = auth.uid(),
         fecha_despacho = coalesce(fecha_despacho, now()), fecha_ultimo_despacho = now(),
         valor_despachado = valor_despachado + v_total, updated_at = now()
   WHERE id = p_solicitud_id;

  PERFORM fn_evento_solicitud(p_solicitud_id, 'despachar', v_sol.estado, v_nuevo,
    coalesce(NULLIF(trim(coalesce(p_comentario,'')), '') || ' — ', '') || v_count || ' insumo(s) despachado(s)');

  RETURN jsonb_build_object('estado', v_nuevo, 'valor', v_total);
END $$;

-- Recepción por parte del área. p_items: [{item_id, cantidad}] (si se omite un ítem se asume recibido completo)
CREATE OR REPLACE FUNCTION fn_recibir_solicitud(p_solicitud_id UUID, p_items JSONB, p_observaciones TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sol solicitudes%ROWTYPE;
  v_x RECORD;
  v_item solicitud_items%ROWTYPE;
  v_novedad BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_sol FROM solicitudes WHERE id = p_solicitud_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF NOT fn_en_area(v_sol.area_id) THEN RAISE EXCEPTION 'Solo el área solicitante puede confirmar la recepción'; END IF;
  IF v_sol.estado NOT IN ('despachada','despachada_parcial') THEN RAISE EXCEPTION 'Solo se pueden recibir solicitudes despachadas'; END IF;

  UPDATE solicitud_items SET cantidad_recibida = cantidad_despachada WHERE solicitud_id = p_solicitud_id;

  IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' THEN
    FOR v_x IN SELECT * FROM jsonb_to_recordset(p_items) AS x(item_id UUID, cantidad NUMERIC) LOOP
      SELECT * INTO v_item FROM solicitud_items WHERE id = v_x.item_id AND solicitud_id = p_solicitud_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Ítem de solicitud no encontrado'; END IF;
      IF v_x.cantidad IS NULL OR v_x.cantidad < 0 OR v_x.cantidad > v_item.cantidad_despachada THEN
        RAISE EXCEPTION 'La cantidad recibida debe estar entre 0 y lo despachado (%)', v_item.cantidad_despachada;
      END IF;
      UPDATE solicitud_items SET cantidad_recibida = v_x.cantidad WHERE id = v_item.id;
    END LOOP;
  END IF;

  v_novedad := EXISTS (SELECT 1 FROM solicitud_items WHERE solicitud_id = p_solicitud_id AND cantidad_recibida < cantidad_despachada);
  IF v_novedad AND trim(coalesce(p_observaciones,'')) = '' THEN
    RAISE EXCEPTION 'Hay diferencias entre lo despachado y lo recibido. Describa la novedad en observaciones';
  END IF;

  UPDATE solicitudes SET estado = 'recibida', recibido_por = auth.uid(), fecha_recepcion = now(),
         observaciones_recepcion = NULLIF(trim(coalesce(p_observaciones,'')), ''), con_novedad = v_novedad, updated_at = now()
   WHERE id = p_solicitud_id;

  PERFORM fn_evento_solicitud(p_solicitud_id, 'recibir', v_sol.estado, 'recibida',
    CASE WHEN v_novedad THEN 'CON NOVEDAD: ' ELSE '' END || coalesce(p_observaciones, ''));
END $$;

CREATE OR REPLACE FUNCTION fn_cerrar_solicitud(p_solicitud_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sol solicitudes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_sol FROM solicitudes WHERE id = p_solicitud_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF NOT (fn_en_area(v_sol.area_id) OR fn_en_farmacia(v_sol.farmacia_id)) THEN RAISE EXCEPTION 'No tiene permiso sobre esta solicitud'; END IF;
  IF v_sol.estado <> 'recibida' THEN RAISE EXCEPTION 'Solo se pueden cerrar solicitudes recibidas'; END IF;
  IF EXISTS (SELECT 1 FROM devoluciones WHERE solicitud_id = p_solicitud_id AND estado = 'pendiente') THEN
    RAISE EXCEPTION 'Hay devoluciones pendientes de confirmar por farmacia';
  END IF;
  UPDATE solicitudes SET estado = 'cerrada', cerrado_por = auth.uid(), fecha_cierre = now(), updated_at = now()
  WHERE id = p_solicitud_id;
  PERFORM fn_evento_solicitud(p_solicitud_id, 'cerrar', 'recibida', 'cerrada', NULL);
END $$;

CREATE OR REPLACE FUNCTION fn_anular_solicitud(p_solicitud_id UUID, p_motivo TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sol solicitudes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF trim(coalesce(p_motivo,'')) = '' THEN RAISE EXCEPTION 'Debe indicar el motivo de la anulación'; END IF;
  SELECT * INTO v_sol FROM solicitudes WHERE id = p_solicitud_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF NOT (fn_en_area(v_sol.area_id) OR fn_en_farmacia(v_sol.farmacia_id)) THEN RAISE EXCEPTION 'No tiene permiso sobre esta solicitud'; END IF;
  IF v_sol.estado NOT IN ('borrador','enviada','aprobada') THEN
    RAISE EXCEPTION 'No se puede anular: la solicitud ya tiene despachos registrados';
  END IF;
  UPDATE solicitudes SET estado = 'anulada', motivo_anulacion = trim(p_motivo), anulado_por = auth.uid(),
         fecha_anulacion = now(), updated_at = now()
  WHERE id = p_solicitud_id;
  PERFORM fn_evento_solicitud(p_solicitud_id, 'anular', v_sol.estado, 'anulada', p_motivo);
END $$;

-- =====================================================================
-- 6. FUNCIONES DE NEGOCIO — DEVOLUCIONES
-- =====================================================================

-- p_items: [{item_id (solicitud_item_id), cantidad, observaciones}]
CREATE OR REPLACE FUNCTION fn_crear_devolucion(p_solicitud_id UUID, p_motivo TEXT, p_detalle TEXT, p_items JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sol solicitudes%ROWTYPE;
  v_x RECORD;
  v_item solicitud_items%ROWTYPE;
  v_pendiente NUMERIC;
  v_disponible NUMERIC;
  v_dev_id UUID;
  v_radicado TEXT;
  v_total NUMERIC := 0;
  v_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_motivo NOT IN ('no_utilizado','vencido','defectuoso','error_despacho','otro') THEN RAISE EXCEPTION 'Motivo de devolución inválido'; END IF;
  IF p_motivo = 'otro' AND trim(coalesce(p_detalle,'')) = '' THEN RAISE EXCEPTION 'Describa el motivo de la devolución'; END IF;

  SELECT * INTO v_sol FROM solicitudes WHERE id = p_solicitud_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF NOT fn_en_area(v_sol.area_id) THEN RAISE EXCEPTION 'Solo el área solicitante puede registrar devoluciones'; END IF;
  IF v_sol.estado <> 'recibida' THEN RAISE EXCEPTION 'Solo se puede devolver sobre solicitudes recibidas y no cerradas'; END IF;

  v_radicado := fn_next_radicado('DEV');
  INSERT INTO devoluciones (radicado, solicitud_id, area_id, farmacia_id, motivo, detalle, devuelto_por)
  VALUES (v_radicado, p_solicitud_id, v_sol.area_id, v_sol.farmacia_id, p_motivo::devolucion_motivo,
          NULLIF(trim(coalesce(p_detalle,'')), ''), auth.uid())
  RETURNING id INTO v_dev_id;

  FOR v_x IN SELECT * FROM jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) AS x(item_id UUID, cantidad NUMERIC, observaciones TEXT) LOOP
    CONTINUE WHEN v_x.cantidad IS NULL OR v_x.cantidad = 0;
    IF v_x.cantidad < 0 THEN RAISE EXCEPTION 'Las cantidades a devolver no pueden ser negativas'; END IF;

    SELECT * INTO v_item FROM solicitud_items WHERE id = v_x.item_id AND solicitud_id = p_solicitud_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Ítem de solicitud no encontrado'; END IF;

    SELECT coalesce(sum(di.cantidad), 0) INTO v_pendiente
      FROM devolucion_items di JOIN devoluciones d ON d.id = di.devolucion_id
     WHERE di.solicitud_item_id = v_item.id AND d.estado = 'pendiente' AND d.id <> v_dev_id;

    v_disponible := v_item.cantidad_recibida - v_item.cantidad_devuelta - v_pendiente;
    IF v_x.cantidad > v_disponible THEN
      RAISE EXCEPTION 'La cantidad a devolver (%) supera lo disponible para devolución (%)', v_x.cantidad, v_disponible;
    END IF;

    INSERT INTO devolucion_items (devolucion_id, solicitud_item_id, material_id, cantidad, costo_unitario, observaciones)
    VALUES (v_dev_id, v_item.id, v_item.material_id, v_x.cantidad, v_item.costo_unitario, NULLIF(trim(coalesce(v_x.observaciones,'')), ''));

    v_total := v_total + round(v_x.cantidad * v_item.costo_unitario, 2);
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN RAISE EXCEPTION 'Debe indicar al menos un insumo a devolver'; END IF;

  UPDATE devoluciones SET valor_total = v_total WHERE id = v_dev_id;
  PERFORM fn_evento_solicitud(p_solicitud_id, 'devolucion_registrada', v_sol.estado, v_sol.estado,
    'Devolución ' || v_radicado || ' (' || p_motivo || ') ' || coalesce(p_detalle, ''));

  RETURN jsonb_build_object('id', v_dev_id, 'radicado', v_radicado);
END $$;

-- p_items: [{item_id (devolucion_item_id), cantidad}] — cantidad aceptada; si se omite se acepta completa
CREATE OR REPLACE FUNCTION fn_confirmar_devolucion(p_devolucion_id UUID, p_items JSONB, p_observaciones TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dev devoluciones%ROWTYPE;
  v_sol solicitudes%ROWTYPE;
  v_x RECORD;
  v_di devolucion_items%ROWTYPE;
  v_total NUMERIC := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_dev FROM devoluciones WHERE id = p_devolucion_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Devolución no encontrada'; END IF;
  IF NOT fn_en_farmacia(v_dev.farmacia_id) THEN RAISE EXCEPTION 'No tiene permiso en la farmacia de esta devolución'; END IF;
  IF v_dev.estado <> 'pendiente' THEN RAISE EXCEPTION 'La devolución ya fue procesada'; END IF;
  SELECT * INTO v_sol FROM solicitudes WHERE id = v_dev.solicitud_id FOR UPDATE;

  UPDATE devolucion_items SET cantidad_aceptada = cantidad WHERE devolucion_id = p_devolucion_id;

  IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' THEN
    FOR v_x IN SELECT * FROM jsonb_to_recordset(p_items) AS x(item_id UUID, cantidad NUMERIC) LOOP
      SELECT * INTO v_di FROM devolucion_items WHERE id = v_x.item_id AND devolucion_id = p_devolucion_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Ítem de devolución no encontrado'; END IF;
      IF v_x.cantidad IS NULL OR v_x.cantidad < 0 OR v_x.cantidad > v_di.cantidad THEN
        RAISE EXCEPTION 'La cantidad aceptada debe estar entre 0 y lo devuelto (%)', v_di.cantidad;
      END IF;
      UPDATE devolucion_items SET cantidad_aceptada = v_x.cantidad WHERE id = v_di.id;
    END LOOP;
  END IF;

  IF EXISTS (SELECT 1 FROM devolucion_items WHERE devolucion_id = p_devolucion_id AND cantidad_aceptada < cantidad)
     AND trim(coalesce(p_observaciones,'')) = '' THEN
    RAISE EXCEPTION 'Indique en observaciones por qué no se acepta la cantidad completa';
  END IF;

  FOR v_di IN SELECT * FROM devolucion_items WHERE devolucion_id = p_devolucion_id AND cantidad_aceptada > 0 LOOP
    PERFORM fn_mover_stock(v_dev.farmacia_id, v_di.material_id, v_di.cantidad_aceptada, 'entrada_devolucion',
                           v_di.costo_unitario, v_dev.solicitud_id, v_dev.id, v_dev.area_id,
                           'Devolución ' || v_dev.radicado || ' (' || v_dev.motivo || ')', NULL, v_dev.radicado);
    UPDATE solicitud_items SET cantidad_devuelta = cantidad_devuelta + v_di.cantidad_aceptada WHERE id = v_di.solicitud_item_id;
    v_total := v_total + round(v_di.cantidad_aceptada * v_di.costo_unitario, 2);
  END LOOP;

  UPDATE devoluciones SET estado = 'confirmada', confirmado_por = auth.uid(), fecha_confirmacion = now(),
         observaciones_farmacia = NULLIF(trim(coalesce(p_observaciones,'')), ''), valor_total = v_total
   WHERE id = p_devolucion_id;

  UPDATE solicitudes SET valor_devuelto = valor_devuelto + v_total, updated_at = now() WHERE id = v_dev.solicitud_id;

  PERFORM fn_evento_solicitud(v_dev.solicitud_id, 'devolucion_confirmada', v_sol.estado, v_sol.estado,
    'Devolución ' || v_dev.radicado || ' confirmada por farmacia. ' || coalesce(p_observaciones, ''));
END $$;

CREATE OR REPLACE FUNCTION fn_rechazar_devolucion(p_devolucion_id UUID, p_motivo TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dev devoluciones%ROWTYPE; v_sol solicitudes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF trim(coalesce(p_motivo,'')) = '' THEN RAISE EXCEPTION 'Debe indicar el motivo del rechazo'; END IF;
  SELECT * INTO v_dev FROM devoluciones WHERE id = p_devolucion_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Devolución no encontrada'; END IF;
  IF NOT fn_en_farmacia(v_dev.farmacia_id) THEN RAISE EXCEPTION 'No tiene permiso en la farmacia de esta devolución'; END IF;
  IF v_dev.estado <> 'pendiente' THEN RAISE EXCEPTION 'La devolución ya fue procesada'; END IF;
  SELECT * INTO v_sol FROM solicitudes WHERE id = v_dev.solicitud_id;
  UPDATE devoluciones SET estado = 'rechazada', confirmado_por = auth.uid(), fecha_confirmacion = now(),
         observaciones_farmacia = trim(p_motivo)
   WHERE id = p_devolucion_id;
  PERFORM fn_evento_solicitud(v_dev.solicitud_id, 'devolucion_rechazada', v_sol.estado, v_sol.estado,
    'Devolución ' || v_dev.radicado || ' rechazada: ' || p_motivo);
END $$;

-- =====================================================================
-- 7. FUNCIONES DE NEGOCIO — STOCK DE FARMACIA
-- =====================================================================

-- Entrada por compra / ingreso. p_items: [{material_id, cantidad, costo_unitario}]
CREATE OR REPLACE FUNCTION fn_registrar_entrada(p_farmacia_id UUID, p_items JSONB, p_proveedor TEXT, p_documento TEXT, p_observaciones TEXT) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_x RECORD; v_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF NOT fn_en_farmacia(p_farmacia_id) THEN RAISE EXCEPTION 'No tiene permiso en esta farmacia'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Debe agregar al menos un insumo'; END IF;

  FOR v_x IN SELECT * FROM jsonb_to_recordset(p_items) AS x(material_id UUID, cantidad NUMERIC, costo_unitario NUMERIC) LOOP
    IF v_x.cantidad IS NULL OR v_x.cantidad <= 0 THEN RAISE EXCEPTION 'Las cantidades deben ser mayores a cero'; END IF;
    IF v_x.costo_unitario IS NULL OR v_x.costo_unitario < 0 THEN RAISE EXCEPTION 'El costo unitario es obligatorio y no puede ser negativo'; END IF;
    PERFORM fn_mover_stock(p_farmacia_id, v_x.material_id, v_x.cantidad, 'entrada_compra', v_x.costo_unitario,
                           NULL, NULL, NULL, p_observaciones, p_proveedor, p_documento);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- Ajuste de inventario físico: fija la cantidad real con justificación obligatoria
CREATE OR REPLACE FUNCTION fn_ajustar_stock(p_farmacia_id UUID, p_material_id UUID, p_cantidad_real NUMERIC, p_motivo TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actual NUMERIC; v_delta NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF NOT fn_en_farmacia(p_farmacia_id) THEN RAISE EXCEPTION 'No tiene permiso en esta farmacia'; END IF;
  IF trim(coalesce(p_motivo,'')) = '' THEN RAISE EXCEPTION 'El motivo del ajuste es obligatorio'; END IF;
  IF p_cantidad_real IS NULL OR p_cantidad_real < 0 THEN RAISE EXCEPTION 'La cantidad real no puede ser negativa'; END IF;

  INSERT INTO stock_farmacia (farmacia_id, material_id, cantidad, costo_promedio)
  SELECT p_farmacia_id, p_material_id, 0, coalesce(i.precio_unitario, 0) FROM inventario i WHERE i.id = p_material_id
  ON CONFLICT (farmacia_id, material_id) DO NOTHING;

  SELECT cantidad INTO v_actual FROM stock_farmacia WHERE farmacia_id = p_farmacia_id AND material_id = p_material_id FOR UPDATE;
  v_delta := p_cantidad_real - coalesce(v_actual, 0);
  IF v_delta = 0 THEN RAISE EXCEPTION 'La cantidad real es igual al stock actual; no hay nada que ajustar'; END IF;

  PERFORM fn_mover_stock(p_farmacia_id, p_material_id, v_delta,
    CASE WHEN v_delta > 0 THEN 'ajuste_positivo'::mov_farmacia_tipo ELSE 'ajuste_negativo'::mov_farmacia_tipo END,
    NULL, NULL, NULL, NULL, p_motivo, NULL, NULL);
END $$;

-- Traslado entre farmacias. p_items: [{material_id, cantidad}]
CREATE OR REPLACE FUNCTION fn_trasladar_stock(p_origen UUID, p_destino UUID, p_items JSONB, p_observaciones TEXT) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_x RECORD; v_costo NUMERIC; v_doc TEXT; v_dest_nombre TEXT; v_orig_nombre TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_origen = p_destino THEN RAISE EXCEPTION 'La farmacia de origen y destino deben ser diferentes'; END IF;
  IF NOT fn_en_farmacia(p_origen) THEN RAISE EXCEPTION 'No tiene permiso en la farmacia de origen'; END IF;
  SELECT nombre INTO v_dest_nombre FROM farmacias WHERE id = p_destino AND activa;
  IF v_dest_nombre IS NULL THEN RAISE EXCEPTION 'La farmacia destino no existe o está inactiva'; END IF;
  SELECT nombre INTO v_orig_nombre FROM farmacias WHERE id = p_origen;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Debe agregar al menos un insumo'; END IF;

  v_doc := fn_next_radicado('TRA');
  FOR v_x IN SELECT * FROM jsonb_to_recordset(p_items) AS x(material_id UUID, cantidad NUMERIC) LOOP
    IF v_x.cantidad IS NULL OR v_x.cantidad <= 0 THEN RAISE EXCEPTION 'Las cantidades deben ser mayores a cero'; END IF;
    v_costo := fn_mover_stock(p_origen, v_x.material_id, -v_x.cantidad, 'traslado_salida', NULL, NULL, NULL, NULL,
                              'Traslado a ' || v_dest_nombre || '. ' || coalesce(p_observaciones,''), NULL, v_doc);
    PERFORM fn_mover_stock(p_destino, v_x.material_id, v_x.cantidad, 'traslado_entrada', v_costo, NULL, NULL, NULL,
                           'Traslado desde ' || v_orig_nombre || '. ' || coalesce(p_observaciones,''), NULL, v_doc);
  END LOOP;
  RETURN v_doc;
END $$;

CREATE OR REPLACE FUNCTION fn_configurar_stock(p_farmacia_id UUID, p_material_id UUID, p_minimo NUMERIC, p_maximo NUMERIC) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF NOT fn_en_farmacia(p_farmacia_id) THEN RAISE EXCEPTION 'No tiene permiso en esta farmacia'; END IF;
  IF p_minimo IS NULL OR p_minimo < 0 THEN RAISE EXCEPTION 'El stock mínimo no puede ser negativo'; END IF;
  IF p_maximo IS NOT NULL AND p_maximo < p_minimo THEN RAISE EXCEPTION 'El stock máximo no puede ser menor al mínimo'; END IF;
  INSERT INTO stock_farmacia (farmacia_id, material_id, cantidad, stock_minimo, stock_maximo, costo_promedio)
  SELECT p_farmacia_id, p_material_id, 0, p_minimo, p_maximo, coalesce(i.precio_unitario, 0) FROM inventario i WHERE i.id = p_material_id
  ON CONFLICT (farmacia_id, material_id) DO UPDATE SET stock_minimo = EXCLUDED.stock_minimo, stock_maximo = EXCLUDED.stock_maximo, updated_at = now();
END $$;

-- =====================================================================
-- 8. VISTAS PARA INDICADORES
-- =====================================================================
CREATE OR REPLACE VIEW v_farmacia_consumo WITH (security_invoker = true) AS
SELECT
  m.id, m.created_at, m.tipo,
  m.farmacia_id, f.nombre AS farmacia_nombre,
  m.area_id, a.nombre AS area_nombre, a.centro_costo,
  m.material_id, i.codigo AS material_codigo, i.nombre AS material_nombre,
  c.nombre AS categoria_nombre, u.nombre AS unidad_nombre,
  m.solicitud_id, m.devolucion_id,
  CASE WHEN m.tipo = 'salida_despacho' THEN m.cantidad ELSE -m.cantidad END AS cantidad_neta,
  CASE WHEN m.tipo = 'salida_despacho' THEN m.valor_total ELSE -m.valor_total END AS valor_neto
FROM movimientos_farmacia m
JOIN farmacias f ON f.id = m.farmacia_id
JOIN areas a ON a.id = m.area_id
JOIN inventario i ON i.id = m.material_id
LEFT JOIN categorias_inventario c ON c.id = i.categoria_id
LEFT JOIN unidades_medida u ON u.id = i.unidad_medida_id
WHERE m.tipo IN ('salida_despacho','entrada_devolucion') AND m.area_id IS NOT NULL;

-- =====================================================================
-- 9. ROW LEVEL SECURITY (defensa en profundidad; las escrituras van por funciones)
-- =====================================================================
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmacias ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_farmacias ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_farmacia ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitud_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitud_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE devoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE devolucion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_farmacia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "areas_select" ON areas;
CREATE POLICY "areas_select" ON areas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "areas_admin" ON areas;
CREATE POLICY "areas_admin" ON areas FOR ALL TO authenticated USING (fn_es_admin()) WITH CHECK (fn_es_admin());

DROP POLICY IF EXISTS "farmacias_select" ON farmacias;
CREATE POLICY "farmacias_select" ON farmacias FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "farmacias_admin" ON farmacias;
CREATE POLICY "farmacias_admin" ON farmacias FOR ALL TO authenticated USING (fn_es_admin()) WITH CHECK (fn_es_admin());

DROP POLICY IF EXISTS "usuario_areas_select" ON usuario_areas;
CREATE POLICY "usuario_areas_select" ON usuario_areas FOR SELECT TO authenticated USING (usuario_id = auth.uid() OR fn_es_admin());
DROP POLICY IF EXISTS "usuario_areas_admin" ON usuario_areas;
CREATE POLICY "usuario_areas_admin" ON usuario_areas FOR ALL TO authenticated USING (fn_es_admin()) WITH CHECK (fn_es_admin());

DROP POLICY IF EXISTS "usuario_farmacias_select" ON usuario_farmacias;
CREATE POLICY "usuario_farmacias_select" ON usuario_farmacias FOR SELECT TO authenticated USING (usuario_id = auth.uid() OR fn_es_admin());
DROP POLICY IF EXISTS "usuario_farmacias_admin" ON usuario_farmacias;
CREATE POLICY "usuario_farmacias_admin" ON usuario_farmacias FOR ALL TO authenticated USING (fn_es_admin()) WITH CHECK (fn_es_admin());

DROP POLICY IF EXISTS "stock_farmacia_select" ON stock_farmacia;
CREATE POLICY "stock_farmacia_select" ON stock_farmacia FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "solicitudes_select" ON solicitudes;
CREATE POLICY "solicitudes_select" ON solicitudes FOR SELECT TO authenticated
  USING (fn_en_area(area_id) OR fn_en_farmacia(farmacia_id));

DROP POLICY IF EXISTS "solicitud_items_select" ON solicitud_items;
CREATE POLICY "solicitud_items_select" ON solicitud_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM solicitudes s WHERE s.id = solicitud_id AND (fn_en_area(s.area_id) OR fn_en_farmacia(s.farmacia_id))));

DROP POLICY IF EXISTS "solicitud_eventos_select" ON solicitud_eventos;
CREATE POLICY "solicitud_eventos_select" ON solicitud_eventos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM solicitudes s WHERE s.id = solicitud_id AND (fn_en_area(s.area_id) OR fn_en_farmacia(s.farmacia_id))));

DROP POLICY IF EXISTS "devoluciones_select" ON devoluciones;
CREATE POLICY "devoluciones_select" ON devoluciones FOR SELECT TO authenticated
  USING (fn_en_area(area_id) OR fn_en_farmacia(farmacia_id));

DROP POLICY IF EXISTS "devolucion_items_select" ON devolucion_items;
CREATE POLICY "devolucion_items_select" ON devolucion_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM devoluciones d WHERE d.id = devolucion_id AND (fn_en_area(d.area_id) OR fn_en_farmacia(d.farmacia_id))));

DROP POLICY IF EXISTS "movimientos_farmacia_select" ON movimientos_farmacia;
CREATE POLICY "movimientos_farmacia_select" ON movimientos_farmacia FOR SELECT TO authenticated
  USING (fn_en_farmacia(farmacia_id) OR (area_id IS NOT NULL AND fn_en_area(area_id)));

-- Los nuevos roles deben poder leer el catálogo de insumos
DROP POLICY IF EXISTS "Farmacia read inventario" ON inventario;
CREATE POLICY "Farmacia read inventario" ON inventario FOR SELECT TO authenticated
  USING (get_current_user_role() IN ('farmacia','jefe_area'));
DROP POLICY IF EXISTS "Farmacia read categorias_inventario" ON categorias_inventario;
CREATE POLICY "Farmacia read categorias_inventario" ON categorias_inventario FOR SELECT TO authenticated
  USING (get_current_user_role() IN ('farmacia','jefe_area'));
DROP POLICY IF EXISTS "Farmacia read unidades_medida" ON unidades_medida;
CREATE POLICY "Farmacia read unidades_medida" ON unidades_medida FOR SELECT TO authenticated
  USING (get_current_user_role() IN ('farmacia','jefe_area'));

-- Recargar el esquema de la API
NOTIFY pgrst, 'reload schema';
