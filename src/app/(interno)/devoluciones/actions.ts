'use server'
// src/app/(interno)/devoluciones/actions.ts
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearDevolucionAction(
  solicitudId: string,
  motivo: 'no_utilizado' | 'vencido' | 'defectuoso' | 'error_despacho' | 'otro',
  detalle?: string,
  items?: { item_id: string; cantidad: number; observaciones?: string }[]
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    if (!solicitudId) return { success: false, error: 'Solicitud no especificada' }
    if (!items || items.length === 0) return { success: false, error: 'Debe indicar al menos un insumo' }

    const { data, error } = await supabase.rpc('fn_crear_devolucion', {
      p_solicitud_id: solicitudId,
      p_motivo: motivo,
      p_detalle: detalle || null,
      p_items: items,
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/devoluciones')
    revalidatePath(`/solicitudes/${solicitudId}`)
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear devolución' }
  }
}

export async function confirmarDevolucionAction(
  devolucionId: string,
  items: { item_id: string; cantidad: number }[],
  observaciones?: string
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const { error } = await supabase.rpc('fn_confirmar_devolucion', {
      p_devolucion_id: devolucionId,
      p_items: items,
      p_observaciones: observaciones || null,
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/devoluciones')
    revalidatePath(`/devoluciones/${devolucionId}`)
    revalidatePath('/farmacia/stock')
    revalidatePath('/farmacia/kardex')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al confirmar devolución' }
  }
}

export async function rechazarDevolucionAction(devolucionId: string, motivo: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    if (!motivo || !motivo.trim()) return { success: false, error: 'Debe indicar el motivo del rechazo' }

    const { error } = await supabase.rpc('fn_rechazar_devolucion', {
      p_devolucion_id: devolucionId,
      p_motivo: motivo.trim(),
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/devoluciones')
    revalidatePath(`/devoluciones/${devolucionId}`)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al rechazar devolución' }
  }
}
