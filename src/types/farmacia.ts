// src/types/farmacia.ts
// Tipos TypeScript para el módulo de Farmacia, Áreas, Solicitudes, Devoluciones y Stock

import type { Usuario } from './database'

export type SolicitudEstado =
  | 'borrador'
  | 'enviada'
  | 'aprobada'
  | 'rechazada'
  | 'despachada_parcial'
  | 'despachada'
  | 'recibida'
  | 'cerrada'
  | 'anulada'

export type SolicitudTipo = 'puntual' | 'semanal' | 'mensual'

export type SolicitudPrioridad = 'normal' | 'urgente'

export type DevolucionEstado = 'pendiente' | 'confirmada' | 'rechazada'

export type DevolucionMotivo =
  | 'no_utilizado'
  | 'vencido'
  | 'defectuoso'
  | 'error_despacho'
  | 'otro'

export type MovFarmaciaTipo =
  | 'entrada_compra'
  | 'salida_despacho'
  | 'entrada_devolucion'
  | 'ajuste_positivo'
  | 'ajuste_negativo'
  | 'traslado_entrada'
  | 'traslado_salida'

export interface Area {
  id: string
  codigo: string
  nombre: string
  centro_costo: string | null
  descripcion: string | null
  responsable_id: string | null
  activa: boolean
  created_at: string
  updated_at: string
  responsable?: Usuario | null
  usuarios_asignados?: { usuario_id: string; usuario: Usuario }[]
}

export interface Farmacia {
  id: string
  codigo: string
  nombre: string
  ubicacion: string | null
  descripcion: string | null
  responsable_id: string | null
  activa: boolean
  created_at: string
  updated_at: string
  responsable?: Usuario | null
  usuarios_asignados?: { usuario_id: string; usuario: Usuario }[]
}

export interface UsuarioArea {
  usuario_id: string
  area_id: string
  created_at: string
  usuario?: Usuario
  area?: Area
}

export interface UsuarioFarmacia {
  usuario_id: string
  farmacia_id: string
  created_at: string
  usuario?: Usuario
  farmacia?: Farmacia
}

export interface StockFarmacia {
  id: string
  farmacia_id: string
  material_id: string
  cantidad: number
  stock_minimo: number
  stock_maximo: number | null
  costo_promedio: number
  lote_id?: string | null
  updated_at: string
  farmacia?: Farmacia
  material?: {
    id: string
    codigo: string
    nombre: string
    unidad_medida?: { nombre: string; abreviatura: string | null } | null
    categoria?: { nombre: string } | null
    precio_unitario: number
  }
}

export interface Solicitud {
  id: string
  radicado: string
  area_id: string
  farmacia_id: string
  tipo: SolicitudTipo
  prioridad: SolicitudPrioridad
  periodo_inicio: string | null
  periodo_fin: string | null
  estado: SolicitudEstado
  observaciones: string | null
  motivo_rechazo: string | null
  motivo_anulacion: string | null
  observaciones_recepcion: string | null
  con_novedad: boolean
  valor_despachado: number
  valor_devuelto: number
  creado_por: string
  solicitado_por: string | null
  fecha_solicitud: string | null
  aprobado_por: string | null
  fecha_aprobacion: string | null
  despachado_por: string | null
  fecha_despacho: string | null
  fecha_ultimo_despacho: string | null
  recibido_por: string | null
  fecha_recepcion: string | null
  cerrado_por: string | null
  fecha_cierre: string | null
  anulado_por: string | null
  fecha_anulacion: string | null
  created_at: string
  updated_at: string
  // Relaciones
  area?: Area
  farmacia?: Farmacia
  creador?: Usuario
  solicitante?: Usuario
  aprobador?: Usuario
  despachador?: Usuario
  recibidor?: Usuario
  items?: SolicitudItem[]
  eventos?: SolicitudEvento[]
}

export interface SolicitudItem {
  id: string
  solicitud_id: string
  material_id: string
  cantidad_solicitada: number
  cantidad_aprobada: number | null
  cantidad_despachada: number
  cantidad_recibida: number
  cantidad_devuelta: number
  costo_unitario: number
  observaciones: string | null
  lote_id?: string | null
  created_at: string
  material?: {
    id: string
    codigo: string
    nombre: string
    unidad_medida?: { nombre: string; abreviatura: string | null } | null
    categoria?: { nombre: string } | null
    precio_unitario: number
  }
}

export interface SolicitudEvento {
  id: string
  solicitud_id: string
  accion: string
  estado_anterior: SolicitudEstado | null
  estado_nuevo: SolicitudEstado | null
  comentario: string | null
  usuario_id: string
  created_at: string
  usuario?: Usuario
}

export interface Devolucion {
  id: string
  radicado: string
  solicitud_id: string
  area_id: string
  farmacia_id: string
  estado: DevolucionEstado
  motivo: DevolucionMotivo
  detalle: string | null
  observaciones_farmacia: string | null
  valor_total: number
  devuelto_por: string
  fecha_devolucion: string
  confirmado_por: string | null
  fecha_confirmacion: string | null
  created_at: string
  area?: Area
  farmacia?: Farmacia
  solicitud?: Pick<Solicitud, 'id' | 'radicado'>
  usuario_devuelve?: Usuario
  usuario_confirma?: Usuario
  items?: DevolucionItem[]
}

export interface DevolucionItem {
  id: string
  devolucion_id: string
  solicitud_item_id: string
  material_id: string
  cantidad: number
  cantidad_aceptada: number | null
  costo_unitario: number
  observaciones: string | null
  created_at: string
  material?: {
    id: string
    codigo: string
    nombre: string
    unidad_medida?: { nombre: string; abreviatura: string | null } | null
  }
}

export interface MovimientoFarmacia {
  id: string
  farmacia_id: string
  material_id: string
  tipo: MovFarmaciaTipo
  cantidad: number
  stock_anterior: number
  stock_resultante: number
  costo_unitario: number
  valor_total: number
  solicitud_id: string | null
  devolucion_id: string | null
  area_id: string | null
  documento_referencia: string | null
  proveedor: string | null
  motivo: string | null
  lote_id: string | null
  usuario_id: string
  created_at: string
  farmacia?: Farmacia
  material?: {
    id: string
    codigo: string
    nombre: string
    unidad_medida?: { nombre: string; abreviatura: string | null } | null
  }
  area?: Area
  usuario?: Usuario
}

// ─── Helpers visuales y diccionarios ──────────────────────────────────────────

export const SOLICITUD_ESTADO_LABELS: Record<SolicitudEstado, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada (Pendiente)',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  despachada_parcial: 'Despacho Parcial',
  despachada: 'Despachada Total',
  recibida: 'Recibida en Área',
  cerrada: 'Cerrada',
  anulada: 'Anulada',
}

export const SOLICITUD_ESTADO_COLORS: Record<SolicitudEstado, string> = {
  borrador: 'bg-slate-700/60 text-slate-300 border-slate-600',
  enviada: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  aprobada: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  rechazada: 'bg-red-500/10 text-red-400 border-red-500/30',
  despachada_parcial: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  despachada: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  recibida: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  cerrada: 'bg-slate-800 text-slate-400 border-slate-700',
  anulada: 'bg-rose-950/40 text-rose-400 border-rose-800',
}

export const SOLICITUD_TIPO_LABELS: Record<SolicitudTipo, string> = {
  puntual: 'Puntual / Inmediata',
  semanal: 'Programada Semanal',
  mensual: 'Programada Mensual',
}

export const SOLICITUD_PRIORIDAD_LABELS: Record<SolicitudPrioridad, string> = {
  normal: 'Normal',
  urgente: 'Urgente 🚨',
}

export const DEVOLUCION_ESTADO_LABELS: Record<DevolucionEstado, string> = {
  pendiente: 'Pendiente en Farmacia',
  confirmada: 'Confirmada / Ingresada',
  rechazada: 'Rechazada',
}

export const DEVOLUCION_ESTADO_COLORS: Record<DevolucionEstado, string> = {
  pendiente: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  confirmada: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  rechazada: 'bg-red-500/10 text-red-400 border-red-500/30',
}

export const DEVOLUCION_MOTIVO_LABELS: Record<DevolucionMotivo, string> = {
  no_utilizado: 'No utilizado en el área',
  vencido: 'Fecha próxima o vencido',
  defectuoso: 'Producto defectuoso / dañado',
  error_despacho: 'Error en despacho',
  otro: 'Otro motivo',
}

export const MOV_FARMACIA_TIPO_LABELS: Record<MovFarmaciaTipo, string> = {
  entrada_compra: 'Entrada por Compra / Ingreso',
  salida_despacho: 'Salida por Despacho a Área',
  entrada_devolucion: 'Entrada por Devolución de Área',
  ajuste_positivo: 'Ajuste Físico (+)',
  ajuste_negativo: 'Ajuste Físico (-)',
  traslado_entrada: 'Traslado Entrada',
  traslado_salida: 'Traslado Salida',
}
