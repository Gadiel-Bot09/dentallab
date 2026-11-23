-- ============================================================================
-- supabase/migrations/00010_rbac_roles_permisos.sql
-- Sistema RBAC (Control de Acceso Basado en Roles y Permisos Personalizados)
--   - Tabla `roles`: 7 roles de sistema + creación ilimitada de roles propios
--   - Tabla `permisos`: catálogo granular de 32 permisos por módulo y proceso
--     (Solicitud de Insumos, Solicitud de Prótesis, Farmacia, Clínica, Admin)
--   - Tabla `rol_permisos`: matriz de permisos por rol
--   - Tabla `usuario_permisos`: excepciones individuales (+conceder / -revocar)
--   - Columna `usuarios.rol_id` vinculada a `roles(id)` (retrocompatible con
--     el ENUM `usuarios.rol` usado por RLS y funciones existentes)
--   - Funciones SQL `fn_tiene_permiso(TEXT)` y `fn_mis_permisos()`
-- ============================================================================

-- =====================================================================
-- 1. TABLA DE ROLES
-- =====================================================================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    nombre TEXT UNIQUE NOT NULL,
    descripcion TEXT,
    color TEXT NOT NULL DEFAULT 'sky',
    es_sistema BOOLEAN NOT NULL DEFAULT false,
    rol_base user_rol NOT NULL DEFAULT 'auxiliar',
    home_path TEXT NOT NULL DEFAULT '/dashboard',
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 2. CATÁLOGO DE PERMISOS GRANULARES
-- =====================================================================
CREATE TABLE IF NOT EXISTS permisos (
    codigo TEXT PRIMARY KEY,
    modulo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    orden INTEGER NOT NULL DEFAULT 0
);

-- =====================================================================
-- 3. RELACIÓN ROL <-> PERMISOS
-- =====================================================================
CREATE TABLE IF NOT EXISTS rol_permisos (
    rol_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permiso_codigo TEXT NOT NULL REFERENCES permisos(codigo) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (rol_id, permiso_codigo)
);

-- =====================================================================
-- 4. EXCEPCIONES INDIVIDUALES POR USUARIO (+CONCEDER / -REVOCAR)
-- =====================================================================
CREATE TABLE IF NOT EXISTS usuario_permisos (
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    permiso_codigo TEXT NOT NULL REFERENCES permisos(codigo) ON DELETE CASCADE,
    concedido BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, permiso_codigo)
);

-- =====================================================================
-- 5. VINCULAR `usuarios.rol_id` A `roles`
-- =====================================================================
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS rol_id UUID REFERENCES roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_rol_id ON usuarios(rol_id);
CREATE INDEX IF NOT EXISTS idx_rol_permisos_rol ON rol_permisos(rol_id);
CREATE INDEX IF NOT EXISTS idx_usuario_permisos_usr ON usuario_permisos(usuario_id);

-- =====================================================================
-- 6. SEMILLA DEL CATÁLOGO DE PERMISOS
-- =====================================================================
INSERT INTO permisos (codigo, modulo, nombre, descripcion, orden) VALUES
  -- General
  ('dashboard.ver',              'general',        'Ver Dashboard principal',             'Acceso al panel principal de indicadores generales', 10),

  -- Proceso: Solicitud de Insumos y Devoluciones
  ('solicitudes.ver',            'insumos',        'Ver solicitudes de insumos',          'Consultar listado y detalle de solicitudes de insumos a farmacia', 20),
  ('solicitudes.crear',          'insumos',        'Crear y enviar solicitudes',          'Generar nuevas solicitudes puntuales, semanales o mensuales de insumos', 21),
  ('solicitudes.aprobar',        'insumos',        'Aprobar o rechazar solicitudes',      'Revisar, ajustar cantidades aprobadas o rechazar pedidos en farmacia', 22),
  ('solicitudes.despachar',      'insumos',        'Despachar insumos (Farmacia)',        'Confirmar despachos totales o parciales descontando stock FEFO', 23),
  ('solicitudes.recibir',        'insumos',        'Confirmar recepción en área',         'Confirmar recibo de insumos despachados y reportar novedades', 24),
  ('solicitudes.anular',         'insumos',        'Anular solicitudes',                  'Anular solicitudes en borrador, enviadas o aprobadas sin despacho', 25),
  ('devoluciones.ver',           'insumos',        'Ver devoluciones',                    'Consultar listado y detalle de devoluciones hacia farmacia', 26),
  ('devoluciones.crear',         'insumos',        'Registrar devoluciones de área',      'Solicitar devolución de insumos sobrantes, vencidos o defectuosos', 27),
  ('devoluciones.confirmar',     'insumos',        'Confirmar devoluciones (Farmacia)',   'Aceptar o rechazar devoluciones reingresando al inventario de farmacia', 28),

  -- Proceso: Solicitud de Prótesis (Órdenes de Laboratorio)
  ('ordenes.ver',                'protesis',       'Ver órdenes de prótesis',             'Consultar órdenes de servicio protésico y odontogramas', 30),
  ('ordenes.crear',              'protesis',       'Crear solicitud de prótesis',         'Registrar nuevas órdenes protésicas con odontograma y materiales', 31),
  ('ordenes.cambiar_estado',     'protesis',       'Cambiar estado de órdenes',           'Avanzar estados del flujo protésico (envío lab, recibido, entregado)', 32),
  ('ordenes.ver_financiero',     'protesis',       'Ver costos y rentabilidad protésica', 'Visualizar costos de materiales, precio de venta y margen bruto', 33),
  ('ordenes.documentos',         'protesis',       'Gestionar documentos y fotos',        'Subir y descargar especificaciones, radiografías y fotos de órdenes', 34),

  -- Farmacia, Stock Normativo y Reportes
  ('farmacia.stock_ver',         'farmacia',       'Ver stock y lotes de farmacia',       'Consultar existencias, vencimientos FEFO y actas de recepción', 40),
  ('farmacia.recepcion_registrar','farmacia',      'Registrar entradas / compras',        'Ejecutar recepción técnica normativa (lotes, INVIMA, código barras, acta PDF)', 41),
  ('farmacia.ajustar_stock',     'farmacia',       'Ajustar y configurar stock',          'Realizar ajustes físicos, traslados entre farmacias y umbrales mín/máx', 42),
  ('farmacia.lotes_gestionar',   'farmacia',       'Gestionar cuarentena y lotes',        'Liberar lotes de cuarentena, poner en cuarentena o retirar vencidos', 43),
  ('farmacia.kardex_ver',        'farmacia',       'Ver Kardex inmutable',                'Auditar historial completo de entradas, salidas, lotes y usuarios', 44),
  ('farmacia.reportes_ver',      'farmacia',       'Ver indicadores y exportar reportes', 'Consultar consumo por área y exportar reportes a Excel y PDF', 45),

  -- Clínica, Pacientes e Inventario Laboratorio
  ('pacientes.ver',              'clinica',        'Ver pacientes',                       'Consultar historias clínicas básicas y listado de pacientes', 50),
  ('pacientes.gestionar',        'clinica',        'Crear y editar pacientes',            'Registrar nuevos pacientes y actualizar datos demográficos', 51),
  ('inventario.ver',             'clinica',        'Ver catálogo / inventario lab',       'Consultar catálogo maestro de insumos y stock del laboratorio', 52),
  ('inventario.gestionar',       'clinica',        'Crear y editar insumos en catálogo',  'Registrar nuevos insumos, códigos de barras, INVIMA y precios', 53),
  ('clinica.directorio',         'clinica',        'Ver clínicas, labs y odontólogos',    'Acceder a directorios de laboratorios aliados y odontólogos', 54),
  ('reportes.lab_ver',           'clinica',        'Ver reportes de laboratorio',         'Consultar indicadores de producción y rentabilidad de prótesis', 55),

  -- Administración y Seguridad
  ('usuarios.ver',               'administracion', 'Ver usuarios del sistema',            'Consultar listado de cuentas de usuario y su estado', 60),
  ('usuarios.gestionar',         'administracion', 'Crear y editar usuarios',             'Crear cuentas, asignar roles/áreas/farmacias, restablecer contraseñas', 61),
  ('roles.gestionar',            'administracion', 'Gestionar roles y permisos',          'Crear roles personalizados y modificar la matriz de permisos del sistema', 62),
  ('areas.gestionar',            'administracion', 'Gestionar áreas institucionales',     'Crear, editar áreas y asignar centros de costo y responsables', 63),
  ('farmacias.gestionar',        'administracion', 'Gestionar farmacias / bodegas',       'Crear y configurar sedes o bodegas de farmacia', 64),
  ('catalogos.gestionar',        'administracion', 'Gestionar catálogos maestros',        'Configurar especialidades, servicios protésicos, categorías y unidades', 65)
ON CONFLICT (codigo) DO UPDATE SET
  modulo = EXCLUDED.modulo,
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  orden = EXCLUDED.orden;

-- =====================================================================
-- 7. SEMILLA DE LOS 7 ROLES BASE DEL SISTEMA
-- =====================================================================
INSERT INTO roles (codigo, nombre, descripcion, color, es_sistema, rol_base, home_path) VALUES
  ('admin',         'Administrador',                'Acceso total e irrestricto a todos los módulos, seguridad y configuración.', 'sky',     true, 'admin',         '/dashboard'),
  ('farmacia',      'Regente / Farmacia',           'Recepción técnica, control de lotes FEFO, despachos, devoluciones y kardex.', 'emerald', true, 'farmacia',      '/solicitudes'),
  ('jefe_area',     'Jefe de Área / Solicitante',   'Generación de solicitudes de insumos para su área, recepción, devoluciones e indicadores.', 'amber',   true, 'jefe_area',     '/solicitudes'),
  ('odontologo',    'Odontólogo',                   'Solicitud de órdenes de prótesis con odontograma, seguimiento de pacientes y reportes.', 'indigo',  true, 'odontologo',    '/dashboard'),
  ('auxiliar',      'Auxiliar Clínico / Lab',       'Apoyo en solicitudes de insumos, órdenes protésicas, pacientes e inventario.', 'violet',  true, 'auxiliar',      '/dashboard'),
  ('recepcionista', 'Recepcionista',                'Registro de pacientes, seguimiento de órdenes protésicas y directorio clínico.', 'rose',    true, 'recepcionista', '/dashboard'),
  ('laboratorio',   'Laboratorio Externo',          'Acceso exclusivo al portal externo para gestionar órdenes protésicas asignadas.', 'slate',   true, 'laboratorio',   '/externo/ordenes')
ON CONFLICT (codigo) DO NOTHING;

-- Permisos por defecto de cada rol de sistema (idempotente)
-- 1) Admin -> todos los permisos
INSERT INTO rol_permisos (rol_id, permiso_codigo)
SELECT r.id, p.codigo FROM roles r CROSS JOIN permisos p WHERE r.codigo = 'admin'
ON CONFLICT DO NOTHING;

-- 2) Farmacia
INSERT INTO rol_permisos (rol_id, permiso_codigo)
SELECT r.id, p.codigo FROM roles r JOIN permisos p ON p.codigo IN (
  'dashboard.ver',
  'solicitudes.ver','solicitudes.aprobar','solicitudes.despachar','solicitudes.anular',
  'devoluciones.ver','devoluciones.confirmar',
  'farmacia.stock_ver','farmacia.recepcion_registrar','farmacia.ajustar_stock',
  'farmacia.lotes_gestionar','farmacia.kardex_ver','farmacia.reportes_ver',
  'inventario.ver','inventario.gestionar'
) WHERE r.codigo = 'farmacia'
ON CONFLICT DO NOTHING;

-- 3) Jefe de Área
INSERT INTO rol_permisos (rol_id, permiso_codigo)
SELECT r.id, p.codigo FROM roles r JOIN permisos p ON p.codigo IN (
  'dashboard.ver',
  'solicitudes.ver','solicitudes.crear','solicitudes.recibir','solicitudes.anular',
  'devoluciones.ver','devoluciones.crear',
  'farmacia.reportes_ver'
) WHERE r.codigo = 'jefe_area'
ON CONFLICT DO NOTHING;

-- 4) Odontólogo
INSERT INTO rol_permisos (rol_id, permiso_codigo)
SELECT r.id, p.codigo FROM roles r JOIN permisos p ON p.codigo IN (
  'dashboard.ver',
  'solicitudes.ver','solicitudes.crear','solicitudes.recibir',
  'ordenes.ver','ordenes.crear','ordenes.cambiar_estado','ordenes.ver_financiero','ordenes.documentos',
  'pacientes.ver','pacientes.gestionar',
  'clinica.directorio','reportes.lab_ver'
) WHERE r.codigo = 'odontologo'
ON CONFLICT DO NOTHING;

-- 5) Auxiliar
INSERT INTO rol_permisos (rol_id, permiso_codigo)
SELECT r.id, p.codigo FROM roles r JOIN permisos p ON p.codigo IN (
  'dashboard.ver',
  'solicitudes.ver','solicitudes.crear','solicitudes.recibir',
  'devoluciones.ver','devoluciones.crear',
  'ordenes.ver','ordenes.crear','ordenes.cambiar_estado','ordenes.documentos',
  'pacientes.ver','pacientes.gestionar',
  'inventario.ver','clinica.directorio'
) WHERE r.codigo = 'auxiliar'
ON CONFLICT DO NOTHING;

-- 6) Recepcionista
INSERT INTO rol_permisos (rol_id, permiso_codigo)
SELECT r.id, p.codigo FROM roles r JOIN permisos p ON p.codigo IN (
  'dashboard.ver',
  'solicitudes.ver',
  'ordenes.ver','ordenes.crear','ordenes.cambiar_estado','ordenes.documentos',
  'pacientes.ver','pacientes.gestionar',
  'clinica.directorio'
) WHERE r.codigo = 'recepcionista'
ON CONFLICT DO NOTHING;

-- 7) Laboratorio Externo
INSERT INTO rol_permisos (rol_id, permiso_codigo)
SELECT r.id, p.codigo FROM roles r JOIN permisos p ON p.codigo IN (
  'ordenes.ver','ordenes.cambiar_estado','ordenes.documentos'
) WHERE r.codigo = 'laboratorio'
ON CONFLICT DO NOTHING;

-- Backfill de rol_id para todos los usuarios existentes
UPDATE usuarios u
   SET rol_id = r.id
  FROM roles r
 WHERE u.rol_id IS NULL
   AND r.codigo = u.rol::TEXT;

-- =====================================================================
-- 8. FUNCIONES SQL DE EVALUACIÓN DE PERMISOS
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_tiene_permiso(p_permiso TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_rol user_rol;
  v_rol_id UUID;
  v_activo BOOLEAN;
  v_override BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  SELECT u.rol, u.rol_id, u.activo INTO v_rol, v_rol_id, v_activo
  FROM usuarios u WHERE u.id = v_uid;

  IF NOT FOUND OR NOT coalesce(v_activo, false) THEN RETURN false; END IF;
  IF v_rol = 'admin' THEN RETURN true; END IF;

  -- 1. Verificar si existe una excepción explícita para el usuario
  SELECT up.concedido INTO v_override
  FROM usuario_permisos up
  WHERE up.usuario_id = v_uid AND up.permiso_codigo = p_permiso;

  IF FOUND THEN RETURN v_override; END IF;

  -- 2. Evaluar permisos heredados del rol asignado
  IF v_rol_id IS NULL THEN
    SELECT id INTO v_rol_id FROM roles WHERE codigo = v_rol::TEXT LIMIT 1;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM rol_permisos rp
    WHERE rp.rol_id = v_rol_id AND rp.permiso_codigo = p_permiso
  );
END $$;

CREATE OR REPLACE FUNCTION fn_mis_permisos() RETURNS TEXT[]
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_rol user_rol;
  v_rol_id UUID;
  v_activo BOOLEAN;
  v_res TEXT[];
BEGIN
  IF v_uid IS NULL THEN RETURN ARRAY[]::TEXT[]; END IF;

  SELECT u.rol, u.rol_id, u.activo INTO v_rol, v_rol_id, v_activo
  FROM usuarios u WHERE u.id = v_uid;

  IF NOT FOUND OR NOT coalesce(v_activo, false) THEN RETURN ARRAY[]::TEXT[]; END IF;

  IF v_rol = 'admin' THEN
    SELECT array_agg(codigo ORDER BY orden) INTO v_res FROM permisos;
    RETURN coalesce(v_res, ARRAY[]::TEXT[]);
  END IF;

  IF v_rol_id IS NULL THEN
    SELECT id INTO v_rol_id FROM roles WHERE codigo = v_rol::TEXT LIMIT 1;
  END IF;

  SELECT array_agg(p.codigo ORDER BY p.orden) INTO v_res
  FROM permisos p
  LEFT JOIN rol_permisos rp ON rp.rol_id = v_rol_id AND rp.permiso_codigo = p.codigo
  LEFT JOIN usuario_permisos up ON up.usuario_id = v_uid AND up.permiso_codigo = p.codigo
  WHERE coalesce(up.concedido, rp.permiso_codigo IS NOT NULL);

  RETURN coalesce(v_res, ARRAY[]::TEXT[]);
END $$;

-- Actualizar fn_en_area y fn_en_farmacia para respetar permisos granulares también
CREATE OR REPLACE FUNCTION fn_en_area(p_area_id UUID) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT fn_es_admin()
      OR EXISTS (SELECT 1 FROM usuario_areas WHERE usuario_id = auth.uid() AND area_id = p_area_id);
$$;

CREATE OR REPLACE FUNCTION fn_en_farmacia(p_farmacia_id UUID) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT fn_es_admin()
      OR EXISTS (SELECT 1 FROM usuario_farmacias WHERE usuario_id = auth.uid() AND farmacia_id = p_farmacia_id);
$$;

-- =====================================================================
-- 9. ROW LEVEL SECURITY PARA TABLAS RBAC
-- =====================================================================
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rol_permisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_permisos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select" ON roles;
CREATE POLICY "roles_select" ON roles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "roles_manage" ON roles;
CREATE POLICY "roles_manage" ON roles FOR ALL TO authenticated
  USING (fn_tiene_permiso('roles.gestionar'))
  WITH CHECK (fn_tiene_permiso('roles.gestionar'));

DROP POLICY IF EXISTS "permisos_select" ON permisos;
CREATE POLICY "permisos_select" ON permisos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rol_permisos_select" ON rol_permisos;
CREATE POLICY "rol_permisos_select" ON rol_permisos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rol_permisos_manage" ON rol_permisos;
CREATE POLICY "rol_permisos_manage" ON rol_permisos FOR ALL TO authenticated
  USING (fn_tiene_permiso('roles.gestionar'))
  WITH CHECK (fn_tiene_permiso('roles.gestionar'));

DROP POLICY IF EXISTS "usuario_permisos_select" ON usuario_permisos;
CREATE POLICY "usuario_permisos_select" ON usuario_permisos FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR fn_tiene_permiso('usuarios.ver') OR fn_tiene_permiso('roles.gestionar'));
DROP POLICY IF EXISTS "usuario_permisos_manage" ON usuario_permisos;
CREATE POLICY "usuario_permisos_manage" ON usuario_permisos FOR ALL TO authenticated
  USING (fn_tiene_permiso('usuarios.gestionar') OR fn_tiene_permiso('roles.gestionar'))
  WITH CHECK (fn_tiene_permiso('usuarios.gestionar') OR fn_tiene_permiso('roles.gestionar'));

-- Recargar esquema de PostgREST
NOTIFY pgrst, 'reload schema';
