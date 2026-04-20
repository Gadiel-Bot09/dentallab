-- supabase/migrations/00002_rls_policies.sql

-- Helper Function to securely get current user details
CREATE OR REPLACE FUNCTION get_current_user_role() RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT rol::TEXT FROM usuarios WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_current_user_lab_id() RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT laboratorio_id FROM usuarios WHERE id = auth.uid();
$$;

-- Enable RLS on all tables
ALTER TABLE laboratorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_materiales ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_orden ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_orden ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_sequences ENABLE ROW LEVEL SECURITY;

-- Audit Logs Constraints & Policies
-- We strictly prevent updates and deletes.
CREATE POLICY "Allow INSERT to authenticated" ON audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow SELECT to admin" ON audit_logs FOR SELECT TO authenticated USING (get_current_user_role() = 'admin');

-- Sequence Table (Only the Postgres functions need to update this, so RLS blocks users directly)
CREATE POLICY "Block all access to custom_sequences" ON custom_sequences FOR ALL USING (false);

-- Usuarios
-- Everyone can read their own user record. Admins can read/write all.
CREATE POLICY "Admins full access usuarios" ON usuarios FOR ALL TO authenticated USING (get_current_user_role() = 'admin');
CREATE POLICY "Users read own record" ON usuarios FOR SELECT TO authenticated USING (id = auth.uid());

-- Laboratorios
-- Read-only for internal staff. Labs can read their own. Admins can write.
CREATE POLICY "Admins write laboratorios" ON laboratorios FOR ALL TO authenticated USING (get_current_user_role() = 'admin');
CREATE POLICY "Internals read laboratorios" ON laboratorios FOR SELECT TO authenticated 
USING (get_current_user_role() IN ('odontologo', 'auxiliar', 'recepcionista'));
CREATE POLICY "Lab reads self" ON laboratorios FOR SELECT TO authenticated USING (id = get_current_user_lab_id());

-- Pacientes
-- All internal staff can read/write. Labs have NO access.
CREATE POLICY "Internal staff manage pacientes" ON pacientes FOR ALL TO authenticated 
USING (get_current_user_role() IN ('admin', 'odontologo', 'auxiliar', 'recepcionista'));

-- Ordenes de Servicio
-- Internal staff: Full access
CREATE POLICY "Internal staff manage ordenes" ON ordenes_servicio FOR ALL TO authenticated 
USING (get_current_user_role() IN ('admin', 'odontologo', 'auxiliar', 'recepcionista'));

-- Lab: Read and Update their assigned orders
CREATE POLICY "Lab view assigned ordenes" ON ordenes_servicio FOR SELECT TO authenticated 
USING (get_current_user_role() = 'laboratorio' AND laboratorio_id = get_current_user_lab_id());

CREATE POLICY "Lab update assigned ordenes" ON ordenes_servicio FOR UPDATE TO authenticated 
USING (get_current_user_role() = 'laboratorio' AND laboratorio_id = get_current_user_lab_id());

-- Inventario and Movimientos
-- Internal staff read and write. Labs NO access.
CREATE POLICY "Internal staff manage inventario" ON inventario FOR ALL TO authenticated 
USING (get_current_user_role() IN ('admin', 'odontologo', 'auxiliar', 'recepcionista'));

CREATE POLICY "Internal staff manage mov_inventario" ON movimientos_inventario FOR ALL TO authenticated 
USING (get_current_user_role() IN ('admin', 'odontologo', 'auxiliar', 'recepcionista'));

CREATE POLICY "Internal staff manage orden_materiales" ON orden_materiales FOR ALL TO authenticated 
USING (get_current_user_role() IN ('admin', 'odontologo', 'auxiliar', 'recepcionista'));

-- Eventos Orden
-- Internals full access. Labs can read events for their orders and insert new ones.
CREATE POLICY "Internal manage eventos" ON eventos_orden FOR ALL TO authenticated 
USING (get_current_user_role() IN ('admin', 'odontologo', 'auxiliar', 'recepcionista'));

CREATE POLICY "Lab view assigned order events" ON eventos_orden FOR SELECT TO authenticated 
USING (
  get_current_user_role() = 'laboratorio' 
  AND orden_id IN (SELECT id FROM ordenes_servicio WHERE laboratorio_id = get_current_user_lab_id())
);

CREATE POLICY "Lab insert assigned order events" ON eventos_orden FOR INSERT TO authenticated 
WITH CHECK (
  get_current_user_role() = 'laboratorio' 
  AND orden_id IN (SELECT id FROM ordenes_servicio WHERE laboratorio_id = get_current_user_lab_id())
);

-- Documentos Orden
CREATE POLICY "Internal manage documentos" ON documentos_orden FOR ALL TO authenticated 
USING (get_current_user_role() IN ('admin', 'odontologo', 'auxiliar', 'recepcionista'));

CREATE POLICY "Lab view assigned order docs" ON documentos_orden FOR SELECT TO authenticated 
USING (
  get_current_user_role() = 'laboratorio' 
  AND orden_id IN (SELECT id FROM ordenes_servicio WHERE laboratorio_id = get_current_user_lab_id())
);

CREATE POLICY "Lab insert assigned order docs" ON documentos_orden FOR INSERT TO authenticated 
WITH CHECK (
  get_current_user_role() = 'laboratorio' 
  AND orden_id IN (SELECT id FROM ordenes_servicio WHERE laboratorio_id = get_current_user_lab_id())
);
