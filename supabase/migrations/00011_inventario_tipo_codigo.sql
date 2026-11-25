-- ============================================================================
-- supabase/migrations/00011_inventario_tipo_codigo.sql
-- Clasificación de ítems del catálogo `inventario` y códigos consecutivos
-- diferenciados por tipo de ítem:
--   - 'insumo'      -> INS-0001 (Insumos clínicos / odontológicos / farmacia)
--   - 'medicamento' -> MED-0001 (Medicamentos controlados y generales)
--   - 'material'    -> MAT-0001 (Materiales de laboratorio dental / prótesis)
-- ============================================================================

-- 1. Agregar columna `tipo_item` al catálogo maestro
ALTER TABLE inventario
  ADD COLUMN IF NOT EXISTS tipo_item TEXT NOT NULL DEFAULT 'material';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_inventario_tipo_item') THEN
    ALTER TABLE inventario
      ADD CONSTRAINT chk_inventario_tipo_item
      CHECK (tipo_item IN ('insumo', 'medicamento', 'material'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inventario_tipo_item ON inventario(tipo_item);

COMMENT ON COLUMN inventario.tipo_item IS
  'Clasificación del catálogo: insumo (INS-XXXX), medicamento (MED-XXXX) o material de laboratorio (MAT-XXXX)';

-- 2. Inicializar secuencias atómicas independientes en `custom_sequences`
INSERT INTO custom_sequences (sequence_key, last_value)
VALUES
  ('ITEM-INS', 0),
  ('ITEM-MED', 0),
  ('ITEM-MAT', 0)
ON CONFLICT (sequence_key) DO NOTHING;

-- Sincronizar ITEM-MAT con el mayor número MAT-XXXX existente para evitar colisiones
UPDATE custom_sequences
   SET last_value = GREATEST(
     last_value,
     COALESCE((
       SELECT MAX(substring(codigo FROM '^MAT-([0-9]+)$')::INTEGER)
       FROM inventario
       WHERE codigo ~ '^MAT-[0-9]+$'
     ), 0)
   )
 WHERE sequence_key = 'ITEM-MAT';

UPDATE custom_sequences
   SET last_value = GREATEST(
     last_value,
     COALESCE((
       SELECT MAX(substring(codigo FROM '^INS-([0-9]+)$')::INTEGER)
       FROM inventario
       WHERE codigo ~ '^INS-[0-9]+$'
     ), 0)
   )
 WHERE sequence_key = 'ITEM-INS';

UPDATE custom_sequences
   SET last_value = GREATEST(
     last_value,
     COALESCE((
       SELECT MAX(substring(codigo FROM '^MED-([0-9]+)$')::INTEGER)
       FROM inventario
       WHERE codigo ~ '^MED-[0-9]+$'
     ), 0)
   )
 WHERE sequence_key = 'ITEM-MED';

-- 3. Función atómica generadora de código por tipo de ítem
CREATE OR REPLACE FUNCTION generate_inventario_code(p_tipo TEXT DEFAULT 'material')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_seq_key TEXT;
  v_val INTEGER;
  v_code TEXT;
BEGIN
  v_prefix := CASE lower(trim(coalesce(p_tipo, 'material')))
    WHEN 'insumo'      THEN 'INS'
    WHEN 'medicamento' THEN 'MED'
    ELSE 'MAT'
  END;

  v_seq_key := 'ITEM-' || v_prefix;

  INSERT INTO custom_sequences (sequence_key, last_value)
  VALUES (v_seq_key, 0)
  ON CONFLICT (sequence_key) DO NOTHING;

  LOOP
    UPDATE custom_sequences
       SET last_value = last_value + 1
     WHERE sequence_key = v_seq_key
     RETURNING last_value INTO v_val;

    v_code := v_prefix || '-' || LPAD(v_val::TEXT, 4, '0');

    IF NOT EXISTS (SELECT 1 FROM inventario WHERE codigo = v_code) THEN
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$;

-- Mantener retrocompatibilidad con generate_material_code()
CREATE OR REPLACE FUNCTION generate_material_code()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT generate_inventario_code('material');
$$;

-- Recargar esquema de PostgREST
NOTIFY pgrst, 'reload schema';
