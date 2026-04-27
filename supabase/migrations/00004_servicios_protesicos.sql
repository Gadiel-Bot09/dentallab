-- supabase/migrations/00004_servicios_protesicos.sql

CREATE TABLE servicios_protesicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT UNIQUE NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE servicios_protesicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access servicios" ON servicios_protesicos FOR ALL TO authenticated USING (get_current_user_role() = 'admin');
CREATE POLICY "Internal read servicios" ON servicios_protesicos FOR SELECT TO authenticated USING (get_current_user_role() IN ('odontologo', 'auxiliar', 'recepcionista', 'admin'));

-- Insertar los tipos de trabajo actuales como valores iniciales
INSERT INTO servicios_protesicos (nombre) VALUES
('Placa Superior'), 
('Placa Inferior'), 
('Prótesis Parcial Superior'), 
('Prótesis Parcial Inferior'),
('Prótesis Total Superior'), 
('Prótesis Total Inferior'), 
('Corona Porcelana'), 
('Corona Metal-Porcelana'),
('Corona Zirconio'), 
('Puente fijo'), 
('Carilla Porcelana'), 
('Incrustación'), 
('Retenedor'), 
('Otro')
ON CONFLICT (nombre) DO NOTHING;
