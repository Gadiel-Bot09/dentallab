'use server'
// src/app/(interno)/farmacia/stock/actions.ts
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function registrarEntradaAction(
  farmaciaId: string,
  items: { material_id: string; cantidad: number; costo_unitario: number }[],
  proveedor?: string,
  documento?: string,
  observaciones?: string
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    if (!farmaciaId) return { success: false, error: 'Debe seleccionar una farmacia' }
    if (!items || items.length === 0) return { success: false, error: 'Debe incluir al menos un insumo' }

    const { data, error } = await supabase.rpc('fn_registrar_entrada', {
      p_farmacia_id: farmaciaId,
      p_items: items,
      p_proveedor: proveedor || null,
      p_documento: documento || null,
      p_observaciones: observaciones || null,
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/farmacia/stock')
    revalidatePath('/farmacia/kardex')
    return { success: true, count: data }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al registrar entrada' }
  }
}

export async function ajustarStockAction(
  farmaciaId: string,
  materialId: string,
  cantidadReal: number,
  motivo: string
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    if (!farmaciaId || !materialId) return { success: false, error: 'Datos incompletos' }
    if (!motivo || !motivo.trim()) return { success: false, error: 'El motivo del ajuste es obligatorio' }

    const { error } = await supabase.rpc('fn_ajustar_stock', {
      p_farmacia_id: farmaciaId,
      p_material_id: materialId,
      p_cantidad_real: cantidadReal,
      p_motivo: motivo.trim(),
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/farmacia/stock')
    revalidatePath('/farmacia/kardex')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al ajustar stock' }
  }
}

export async function trasladarStockAction(
  origenId: string,
  destinoId: string,
  items: { material_id: string; cantidad: number }[],
  observaciones?: string
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    if (!origenId || !destinoId) return { success: false, error: 'Debe indicar farmacia origen y destino' }
    if (origenId === destinoId) return { success: false, error: 'Origen y destino deben ser distintos' }

    const { data, error } = await supabase.rpc('fn_trasladar_stock', {
      p_origen: origenId,
      p_destino: destinoId,
      p_items: items,
      p_observaciones: observaciones || null,
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/farmacia/stock')
    revalidatePath('/farmacia/kardex')
    return { success: true, radicado: data }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al trasladar insumos' }
  }
}

export async function configurarStockAction(
  farmaciaId: string,
  materialId: string,
  minimo: number,
  maximo: number | null
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const { error } = await supabase.rpc('fn_configurar_stock', {
      p_farmacia_id: farmaciaId,
      p_material_id: materialId,
      p_minimo: minimo,
      p_maximo: maximo,
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/farmacia/stock')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al configurar stock' }
  }
}
