-- ============================================================================
-- 00008_orden_piezas_dentales.sql
-- Odontograma en órdenes de servicio: piezas dentales a tratar / reemplazar.
--
-- piezas_dentales: arreglo JSON con la notación FDI (ISO 3950) y el rol de
-- cada pieza dentro del trabajo protésico:
--   [{ "fdi": 14, "rol": "pilar" }, { "fdi": 15, "rol": "pontico" }, ...]
--   rol ∈ ('tratar','pilar','pontico','ausente')
-- denticion: 'permanente' (adulto), 'temporal' (niño) o 'mixta'.
-- ============================================================================

ALTER TABLE ordenes_servicio
  ADD COLUMN IF NOT EXISTS piezas_dentales JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS denticion TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_ordenes_piezas_dentales_array'
  ) THEN
    ALTER TABLE ordenes_servicio
      ADD CONSTRAINT chk_ordenes_piezas_dentales_array
      CHECK (jsonb_typeof(piezas_dentales) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_ordenes_denticion'
  ) THEN
    ALTER TABLE ordenes_servicio
      ADD CONSTRAINT chk_ordenes_denticion
      CHECK (denticion IS NULL OR denticion IN ('permanente', 'temporal', 'mixta'));
  END IF;
END $$;

-- Permite consultas del tipo: órdenes que involucran la pieza 16
--   WHERE piezas_dentales @> '[{"fdi":16}]'
CREATE INDEX IF NOT EXISTS idx_ordenes_piezas_dentales
  ON ordenes_servicio USING GIN (piezas_dentales jsonb_path_ops);

COMMENT ON COLUMN ordenes_servicio.piezas_dentales IS
  'Odontograma del trabajo: [{fdi:int, rol:tratar|pilar|pontico|ausente}] en notación FDI';
COMMENT ON COLUMN ordenes_servicio.denticion IS
  'Tipo de dentición del trabajo: permanente, temporal o mixta';

-- Refrescar la caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
