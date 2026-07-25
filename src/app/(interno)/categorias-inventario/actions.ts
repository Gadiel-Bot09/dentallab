'use server'
// src/app/(interno)/categorias-inventario/actions.ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearCategoriaAction(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const nombre = formData.get('nombre') as string
    const descripcion = formData.get('descripcion') as string

    if (!nombre) return { success: false, error: 'El nombre es requerido' }

    const adminSupabase = await createAdminClient()
    const { error } = await adminSupabase.from('categorias_inventario').insert({
      nombre,
      descripcion,
    })

    if (error) {
      if (error.code === '23505') return { success: false, error: 'Esta categoría ya existe.' }
      return { success: false, error: error.message }
    }

    revalidatePath('/categorias-inventario')
    revalidatePath('/inventario/nuevo')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear la categoría' }
  }
}

export async function toggleCategoriaAction(id: string, activa: boolean) {
  try {
    const adminSupabase = await createAdminClient()
    const { error } = await adminSupabase
      .from('categorias_inventario')
      .update({ activa })
      .eq('id', id)

    if (error) return { success: false, error: error.message }
    revalidatePath('/categorias-inventario')
    revalidatePath('/inventario/nuevo')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al cambiar el estado' }
  }
}

export async function eliminarCategoriaAction(id: string) {
  try {
    const adminSupabase = await createAdminClient()

    // Verificar si hay materiales con esta categoría
    const { count, error: countError } = await adminSupabase
      .from('inventario')
      .select('*', { count: 'exact', head: true })
      .eq('categoria_id', id)

    if (countError) return { success: false, error: countError.message }
    if (count && count > 0) {
      return { success: false, error: 'No se puede eliminar: Hay materiales usando esta categoría. Te sugerimos desactivarla en su lugar.' }
    }

    const { error } = await adminSupabase.from('categorias_inventario').delete().eq('id', id)
    if (error) return { success: false, error: error.message }

    revalidatePath('/categorias-inventario')
    revalidatePath('/inventario/nuevo')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar la categoría' }
  }
}
