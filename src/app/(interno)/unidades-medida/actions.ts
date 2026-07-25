'use server'
// src/app/(interno)/unidades-medida/actions.ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearUnidadAction(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const nombre = formData.get('nombre') as string
    const abreviatura = formData.get('abreviatura') as string

    if (!nombre) return { success: false, error: 'El nombre es requerido' }

    const adminSupabase = await createAdminClient()
    const { error } = await adminSupabase.from('unidades_medida').insert({
      nombre,
      abreviatura: abreviatura || null,
    })

    if (error) {
      if (error.code === '23505') return { success: false, error: 'Esta unidad ya existe.' }
      return { success: false, error: error.message }
    }

    revalidatePath('/unidades-medida')
    revalidatePath('/inventario/nuevo')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear la unidad de medida' }
  }
}

export async function toggleUnidadAction(id: string, activa: boolean) {
  try {
    const adminSupabase = await createAdminClient()
    const { error } = await adminSupabase
      .from('unidades_medida')
      .update({ activa })
      .eq('id', id)

    if (error) return { success: false, error: error.message }
    revalidatePath('/unidades-medida')
    revalidatePath('/inventario/nuevo')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al cambiar el estado' }
  }
}

export async function eliminarUnidadAction(id: string) {
  try {
    const adminSupabase = await createAdminClient()

    const { count, error: countError } = await adminSupabase
      .from('inventario')
      .select('*', { count: 'exact', head: true })
      .eq('unidad_medida_id', id)

    if (countError) return { success: false, error: countError.message }
    if (count && count > 0) {
      return { success: false, error: 'No se puede eliminar: Hay materiales usando esta unidad. Desactívala en su lugar.' }
    }

    const { error } = await adminSupabase.from('unidades_medida').delete().eq('id', id)
    if (error) return { success: false, error: error.message }

    revalidatePath('/unidades-medida')
    revalidatePath('/inventario/nuevo')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar la unidad' }
  }
}
