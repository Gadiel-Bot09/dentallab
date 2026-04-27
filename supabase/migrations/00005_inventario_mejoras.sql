-- supabase/migrations/00005_inventario_mejoras.sql

-- 1. Create new tables
CREATE TABLE categorias_inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT UNIQUE NOT NULL,
    descripcion TEXT,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE unidades_medida (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT UNIQUE NOT NULL,
    abreviatura TEXT,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE categorias_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades_medida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access categorias_inventario" ON categorias_inventario FOR ALL TO authenticated USING (get_current_user_role() = 'admin');
CREATE POLICY "Internal read categorias_inventario" ON categorias_inventario FOR SELECT TO authenticated USING (get_current_user_role() IN ('odontologo', 'auxiliar', 'recepcionista', 'admin'));

CREATE POLICY "Admins full access unidades_medida" ON unidades_medida FOR ALL TO authenticated USING (get_current_user_role() = 'admin');
CREATE POLICY "Internal read unidades_medida" ON unidades_medida FOR SELECT TO authenticated USING (get_current_user_role() IN ('odontologo', 'auxiliar', 'recepcionista', 'admin'));

-- 2. Populate default values and extract distinct values from existing inventory
INSERT INTO categorias_inventario (nombre)
SELECT DISTINCT categoria FROM inventario WHERE categoria IS NOT NULL
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO categorias_inventario (nombre) VALUES 
('Resinas'), ('Metales'), ('Acrílicos'), ('Adhesivos'), ('Ceras'), ('Yesos'), ('Instrumentos'), ('Otros')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO unidades_medida (nombre)
SELECT DISTINCT unidad_medida FROM inventario WHERE unidad_medida IS NOT NULL
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO unidades_medida (nombre) VALUES 
('Gramos'), ('Mililitros'), ('Unidades'), ('Cajas'), ('Paquetes')
ON CONFLICT (nombre) DO NOTHING;

-- 3. Add FK columns to inventario
ALTER TABLE inventario ADD COLUMN categoria_id UUID REFERENCES categorias_inventario(id) ON DELETE RESTRICT;
ALTER TABLE inventario ADD COLUMN unidad_medida_id UUID REFERENCES unidades_medida(id) ON DELETE RESTRICT;

-- 4. Migrate data
UPDATE inventario i
SET categoria_id = c.id
FROM categorias_inventario c
WHERE i.categoria = c.nombre;

UPDATE inventario i
SET unidad_medida_id = u.id
FROM unidades_medida u
WHERE i.unidad_medida = u.nombre;

-- Wait, what if there are nulls or unmatched? We set a default just in case to avoid constraint violation
UPDATE inventario SET categoria_id = (SELECT id FROM categorias_inventario LIMIT 1) WHERE categoria_id IS NULL;
UPDATE inventario SET unidad_medida_id = (SELECT id FROM unidades_medida LIMIT 1) WHERE unidad_medida_id IS NULL;

ALTER TABLE inventario ALTER COLUMN categoria_id SET NOT NULL;
ALTER TABLE inventario ALTER COLUMN unidad_medida_id SET NOT NULL;

-- 5. Drop old text columns
ALTER TABLE inventario DROP COLUMN categoria;
ALTER TABLE inventario DROP COLUMN unidad_medida;

-- 6. Autogenerate code sequence and function
CREATE SEQUENCE IF NOT EXISTS material_seq START 1;

CREATE OR REPLACE FUNCTION generate_material_code() RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  seq_val INT;
BEGIN
  LOOP
    seq_val := nextval('material_seq');
    new_code := 'MAT-' || LPAD(seq_val::TEXT, 4, '0');
    IF NOT EXISTS (SELECT 1 FROM inventario WHERE codigo = new_code) THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
