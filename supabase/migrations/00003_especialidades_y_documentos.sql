-- supabase/migrations/00003_especialidades_y_documentos.sql

CREATE TABLE especialidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT UNIQUE NOT NULL,
    descripcion TEXT,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE especialidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access especialidades" ON especialidades FOR ALL TO authenticated USING (get_current_user_role() = 'admin');
CREATE POLICY "Internal read especialidades" ON especialidades FOR SELECT TO authenticated USING (get_current_user_role() IN ('odontologo', 'auxiliar', 'recepcionista'));

ALTER TABLE usuarios 
ADD COLUMN documento TEXT UNIQUE,
ADD COLUMN especialidad_id UUID REFERENCES especialidades(id) ON DELETE SET NULL;
