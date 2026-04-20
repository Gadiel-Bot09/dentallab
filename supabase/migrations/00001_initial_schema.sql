-- supabase/migrations/00001_initial_schema.sql

-- Types and Enums
CREATE TYPE user_rol AS ENUM ('admin', 'odontologo', 'auxiliar', 'recepcionista', 'laboratorio');
CREATE TYPE orden_estado AS ENUM ('borrador', 'enviada', 'recibida_lab', 'en_proceso', 'lista', 'enviada_centro', 'recibida_centro', 'entregada_paciente', 'cancelada');
CREATE TYPE modo_gestion AS ENUM ('portal_externo', 'gestion_interna');
CREATE TYPE mov_inventario_tipo AS ENUM ('entrada', 'salida', 'ajuste', 'devolucion');

-- Tables

CREATE TABLE laboratorios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    contacto TEXT,
    email TEXT,
    telefono TEXT,
    portal_activo BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    rol user_rol NOT NULL,
    laboratorio_id UUID REFERENCES laboratorios(id) ON DELETE SET NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE pacientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_historia TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    cedula TEXT UNIQUE NOT NULL,
    fecha_nacimiento DATE,
    telefono TEXT,
    email TEXT,
    odontologo_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE ordenes_servicio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    radicado TEXT UNIQUE NOT NULL,
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
    odontologo_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    laboratorio_id UUID NOT NULL REFERENCES laboratorios(id) ON DELETE RESTRICT,
    tipo_trabajo TEXT NOT NULL,
    descripcion TEXT,
    observaciones_tecnicas TEXT,
    estado orden_estado DEFAULT 'borrador'::orden_estado NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    fecha_envio_lab TIMESTAMP WITH TIME ZONE,
    fecha_recibido_lab TIMESTAMP WITH TIME ZONE,
    fecha_estimada_entrega TIMESTAMP WITH TIME ZONE,
    fecha_enviada_centro TIMESTAMP WITH TIME ZONE,
    fecha_recibida_centro TIMESTAMP WITH TIME ZONE,
    costo_total_materiales NUMERIC(10,2) DEFAULT 0,
    precio_venta NUMERIC(10,2) DEFAULT 0,
    margen_ganancia NUMERIC(5,2) DEFAULT 0,
    registrado_por_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    modo_gestion modo_gestion NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    categoria TEXT NOT NULL,
    unidad_medida TEXT NOT NULL,
    stock_actual NUMERIC(10,2) DEFAULT 0 NOT NULL CHECK (stock_actual >= 0),
    stock_minimo NUMERIC(10,2) DEFAULT 0 NOT NULL,
    precio_unitario NUMERIC(10,2) DEFAULT 0 NOT NULL,
    precio_venta_referencia NUMERIC(10,2) DEFAULT 0 NOT NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE movimientos_inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES inventario(id) ON DELETE RESTRICT,
    orden_id UUID REFERENCES ordenes_servicio(id) ON DELETE SET NULL,
    tipo mov_inventario_tipo NOT NULL,
    cantidad NUMERIC(10,2) NOT NULL,
    stock_anterior NUMERIC(10,2) NOT NULL,
    stock_resultante NUMERIC(10,2) NOT NULL,
    motivo TEXT,
    observaciones TEXT,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE orden_materiales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orden_id UUID NOT NULL REFERENCES ordenes_servicio(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES inventario(id) ON DELETE RESTRICT,
    cantidad_usada NUMERIC(10,2) NOT NULL,
    costo_unitario_momento NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE eventos_orden (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orden_id UUID NOT NULL REFERENCES ordenes_servicio(id) ON DELETE CASCADE,
    tipo_evento TEXT NOT NULL,
    estado_anterior orden_estado,
    estado_nuevo orden_estado,
    descripcion TEXT,
    actor_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    actor_rol TEXT NOT NULL,
    modo modo_gestion NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE documentos_orden (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orden_id UUID NOT NULL REFERENCES ordenes_servicio(id) ON DELETE CASCADE,
    nombre_archivo TEXT NOT NULL,
    tipo_archivo TEXT NOT NULL,
    tamaño_bytes BIGINT NOT NULL,
    minio_bucket TEXT NOT NULL,
    minio_key TEXT NOT NULL,
    descripcion TEXT,
    categoria TEXT,
    subido_por_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    rol TEXT,
    accion TEXT NOT NULL,
    entidad TEXT NOT NULL,
    entidad_id TEXT NOT NULL,
    ip_address TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Sequence Table for Custom IDs
CREATE TABLE custom_sequences (
    sequence_key TEXT PRIMARY KEY,
    last_value INTEGER NOT NULL DEFAULT 0
);

-- Functions
CREATE OR REPLACE FUNCTION generate_radicado()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_year TEXT;
    v_month TEXT;
    v_seq_key TEXT;
    v_next_val INTEGER;
    v_radicado TEXT;
BEGIN
    v_year := to_char(CURRENT_DATE, 'YYYY');
    v_month := to_char(CURRENT_DATE, 'MM');
    v_seq_key := 'RAD-' || v_year || '-' || v_month;
    
    INSERT INTO custom_sequences (sequence_key, last_value)
    VALUES (v_seq_key, 0)
    ON CONFLICT (sequence_key) DO NOTHING;

    -- Increment and get the next value atomically
    UPDATE custom_sequences 
    SET last_value = last_value + 1 
    WHERE sequence_key = v_seq_key
    RETURNING last_value INTO v_next_val;

    v_radicado := v_seq_key || '-' || LPAD(v_next_val::TEXT, 4, '0');
    RETURN v_radicado;
END;
$$;

CREATE OR REPLACE FUNCTION generate_paciente_historia()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_year TEXT;
    v_seq_key TEXT;
    v_next_val INTEGER;
    v_historia TEXT;
BEGIN
    v_year := to_char(CURRENT_DATE, 'YYYY');
    v_seq_key := 'PAC-' || v_year;
    
    INSERT INTO custom_sequences (sequence_key, last_value)
    VALUES (v_seq_key, 0)
    ON CONFLICT (sequence_key) DO NOTHING;

    -- Increment and get the next value atomically
    UPDATE custom_sequences 
    SET last_value = last_value + 1 
    WHERE sequence_key = v_seq_key
    RETURNING last_value INTO v_next_val;

    v_historia := v_seq_key || '-' || LPAD(v_next_val::TEXT, 4, '0');
    RETURN v_historia;
END;
$$;
