// src/types/database.ts
// Central TypeScript types mirroring the Supabase database schema

export type UserRol = 'admin' | 'odontologo' | 'auxiliar' | 'recepcionista' | 'laboratorio'

export type OrdenEstado =
  | 'borrador'
  | 'enviada'
  | 'recibida_lab'
  | 'en_proceso'
  | 'lista'
  | 'enviada_centro'
  | 'recibida_centro'
  | 'entregada_paciente'
  | 'cancelada'

export type ModoGestion = 'portal_externo' | 'gestion_interna'

export type MovInventarioTipo = 'entrada' | 'salida' | 'ajuste' | 'devolucion'

// ─── Laboratorio ─────────────────────────────────────────────────────────────

export interface Laboratorio {
  id: string
  nombre: string
  contacto: string | null
  email: string | null
  telefono: string | null
  portal_activo: boolean
  created_at: string
}

// ─── Usuario ──────────────────────────────────────────────────────────────────

export interface Usuario {
  id: string
  email: string
  nombre: string
  apellido: string
  rol: UserRol
  laboratorio_id: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface UsuarioConLab extends Usuario {
  laboratorios?: Laboratorio | null
}

// ─── Paciente ─────────────────────────────────────────────────────────────────

export interface Paciente {
  id: string
  numero_historia: string
  nombre: string
  apellido: string
  cedula: string
  fecha_nacimiento: string | null
  telefono: string | null
  email: string | null
  odontologo_id: string | null
  created_at: string
  updated_at: string
}

export interface PacienteConOdontologo extends Paciente {
  usuarios?: Pick<Usuario, 'nombre' | 'apellido'> | null
}

// ─── Inventario ───────────────────────────────────────────────────────────────

export interface Inventario {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  categoria: string
  unidad_medida: string
  stock_actual: number
  stock_minimo: number
  precio_unitario: number
  precio_venta_referencia: number
  activo: boolean
  created_at: string
  updated_at: string
}

// ─── Orden de Servicio ────────────────────────────────────────────────────────

export interface OrdenServicio {
  id: string
  radicado: string
  paciente_id: string
  odontologo_id: string
  laboratorio_id: string
  tipo_trabajo: string
  descripcion: string | null
  observaciones_tecnicas: string | null
  estado: OrdenEstado
  fecha_creacion: string
  fecha_envio_lab: string | null
  fecha_recibido_lab: string | null
  fecha_estimada_entrega: string | null
  fecha_enviada_centro: string | null
  fecha_recibida_centro: string | null
  costo_total_materiales: number
  precio_venta: number
  margen_ganancia: number
  registrado_por_id: string
  modo_gestion: ModoGestion
  created_at: string
  updated_at: string
}

export interface OrdenServicioCompleta extends OrdenServicio {
  pacientes?: Paciente | null
  odontologo?: Pick<Usuario, 'nombre' | 'apellido' | 'email'> | null
  laboratorios?: Laboratorio | null
  registrado_por?: Pick<Usuario, 'nombre' | 'apellido'> | null
  orden_materiales?: OrdenMaterial[]
  eventos_orden?: EventoOrden[]
  documentos_orden?: DocumentoOrden[]
}

// ─── Orden Material ───────────────────────────────────────────────────────────

export interface OrdenMaterial {
  id: string
  orden_id: string
  material_id: string
  cantidad_usada: number
  costo_unitario_momento: number
  created_at: string
  inventario?: Pick<Inventario, 'nombre' | 'unidad_medida' | 'codigo'>
}

// ─── Movimiento Inventario ────────────────────────────────────────────────────

export interface MovimientoInventario {
  id: string
  material_id: string
  orden_id: string | null
  tipo: MovInventarioTipo
  cantidad: number
  stock_anterior: number
  stock_resultante: number
  motivo: string | null
  observaciones: string | null
  usuario_id: string
  created_at: string
  inventario?: Pick<Inventario, 'nombre' | 'codigo' | 'unidad_medida'>
  usuarios?: Pick<Usuario, 'nombre' | 'apellido'>
}

// ─── Evento Orden ─────────────────────────────────────────────────────────────

export interface EventoOrden {
  id: string
  orden_id: string
  tipo_evento: string
  estado_anterior: OrdenEstado | null
  estado_nuevo: OrdenEstado | null
  descripcion: string | null
  actor_id: string
  actor_rol: string
  modo: ModoGestion
  metadata: Record<string, unknown> | null
  created_at: string
  usuarios?: Pick<Usuario, 'nombre' | 'apellido'>
}

// ─── Documento Orden ──────────────────────────────────────────────────────────

export interface DocumentoOrden {
  id: string
  orden_id: string
  nombre_archivo: string
  tipo_archivo: string
  tamaño_bytes: number
  minio_bucket: string
  minio_key: string
  descripcion: string | null
  categoria: string | null
  subido_por_id: string
  created_at: string
  usuarios?: Pick<Usuario, 'nombre' | 'apellido'>
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string
  usuario_id: string | null
  rol: string | null
  accion: string
  entidad: string
  entidad_id: string
  ip_address: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  usuarios?: Pick<Usuario, 'nombre' | 'apellido' | 'email'>
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

export const ORDEN_ESTADO_LABELS: Record<OrdenEstado, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada al Lab',
  recibida_lab: 'Recibida en Lab',
  en_proceso: 'En Proceso',
  lista: 'Lista',
  enviada_centro: 'Enviada al Centro',
  recibida_centro: 'Recibida en Centro',
  entregada_paciente: 'Entregada al Paciente',
  cancelada: 'Cancelada',
}

export const ORDEN_ESTADO_COLORS: Record<OrdenEstado, string> = {
  borrador: 'bg-slate-100 text-slate-700',
  enviada: 'bg-blue-100 text-blue-700',
  recibida_lab: 'bg-cyan-100 text-cyan-700',
  en_proceso: 'bg-amber-100 text-amber-700',
  lista: 'bg-emerald-100 text-emerald-700',
  enviada_centro: 'bg-violet-100 text-violet-700',
  recibida_centro: 'bg-indigo-100 text-indigo-700',
  entregada_paciente: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
}

export const ROL_LABELS: Record<UserRol, string> = {
  admin: 'Administrador',
  odontologo: 'Odontólogo',
  auxiliar: 'Auxiliar',
  recepcionista: 'Recepcionista',
  laboratorio: 'Laboratorio',
}
