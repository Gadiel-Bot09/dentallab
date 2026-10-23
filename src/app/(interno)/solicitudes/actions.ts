'use server'
// src/app/(interno)/solicitudes/actions.ts
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function guardarSolicitudAction({
  solicitudId,
  areaId,
  farmaciaId,
  tipo,
  prioridad,
  periodoInicio,
  periodoFin,
  observaciones,
  items,
  enviar,
}: {
  solicitudId?: string | null
  areaId: string
  farmaciaId: string
  tipo: 'puntual' | 'semanal' | 'mensual'
  prioridad: 'normal' | 'urgente'
  periodoInicio?: string | null
  periodoFin?: string | null
  observaciones?: string | null
  items: { material_id: string; cantidad: number; observaciones?: string }[]
  enviar: boolean
}) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    if (!areaId) return { success: false, error: 'Debe seleccionar un área solicitante' }
    if (!farmaciaId) return { success: false, error: 'Debe seleccionar una farmacia destino' }
    if (!items || items.length === 0) return { success: false, error: 'Debe agregar al menos un insumo' }

    const { data, error } = await supabase.rpc('fn_guardar_solicitud', {
      p_solicitud_id: solicitudId || null,
      p_area_id: areaId,
      p_farmacia_id: farmaciaId,
      p_tipo: tipo,
      p_prioridad: prioridad,
      p_periodo_inicio: periodoInicio || null,
      p_periodo_fin: periodoFin || null,
      p_observaciones: observaciones || null,
      p_items: items,
      p_enviar: enviar,
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/solicitudes')
    revalidatePath(`/solicitudes/${data.id}`)
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al guardar solicitud' }
  }
}

export async function enviarSolicitudAction(solicitudId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const { error } = await supabase.rpc('fn_enviar_solicitud', {
      p_solicitud_id: solicitudId,
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/solicitudes')
    revalidatePath(`/solicitudes/${solicitudId}`)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al enviar solicitud' }
  }
}

export async function aprobarSolicitudAction(
  solicitudId: string,
  items: { item_id: string; cantidad: number }[],
  comentario?: string
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const { error } = await supabase.rpc('fn_aprobar_solicitud', {
      p_solicitud_id: solicitudId,
      p_items: items,
      p_comentario: comentario || null,
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/solicitudes')
    revalidatePath(`/solicitudes/${solicitudId}`)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al aprobar solicitud' }
  }
}

export async function rechazarSolicitudAction(solicitudId: string, motivo: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    if (!motivo || !motivo.trim()) return { success: false, error: 'Debe indicar el motivo del rechazo' }

    const { error } = await supabase.rpc('fn_rechazar_solicitud', {
      p_solicitud_id: solicitudId,
      p_motivo: motivo.trim(),
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/solicitudes')
    revalidatePath(`/solicitudes/${solicitudId}`)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al rechazar solicitud' }
  }
}

export async function despacharSolicitudAction(
  solicitudId: string,
  items: { item_id: string; cantidad: number }[],
  comentario?: string
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    if (!items || items.length === 0) return { success: false, error: 'Debe indicar las cantidades a despachar' }

    const { data, error } = await supabase.rpc('fn_despachar_solicitud', {
      p_solicitud_id: solicitudId,
      p_items: items,
      p_comentario: comentario || null,
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/solicitudes')
    revalidatePath(`/solicitudes/${solicitudId}`)
    revalidatePath('/farmacia/stock')
    revalidatePath('/farmacia/kardex')
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al despachar insumos' }
  }
}

export async function recibirSolicitudAction(
  solicitudId: string,
  items: { item_id: string; cantidad: number }[],
  observaciones?: string
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const { error } = await supabase.rpc('fn_recibir_solicitud', {
      p_solicitud_id: solicitudId,
      p_items: items,
      p_observaciones: observaciones || null,
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/solicitudes')
    revalidatePath(`/solicitudes/${solicitudId}`)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al confirmar recepción' }
  }
}

export async function cerrarSolicitudAction(solicitudId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const { error } = await supabase.rpc('fn_cerrar_solicitud', {
      p_solicitud_id: solicitudId,
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/solicitudes')
    revalidatePath(`/solicitudes/${solicitudId}`)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al cerrar solicitud' }
  }
}

export async function anularSolicitudAction(solicitudId: string, motivo: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    if (!motivo || !motivo.trim()) return { success: false, error: 'Debe indicar el motivo de la anulación' }

    const { error } = await supabase.rpc('fn_anular_solicitud', {
      p_solicitud_id: solicitudId,
      p_motivo: motivo.trim(),
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/solicitudes')
    revalidatePath(`/solicitudes/${solicitudId}`)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al anular solicitud' }
  }
}
