'use server'
// src/app/(interno)/areas/actions.ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearAreaAction(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const codigo = (formData.get('codigo') as string)?.trim().toUpperCase()
    const nombre = (formData.get('nombre') as string)?.trim()
    const centro_costo = (formData.get('centro_costo') as string)?.trim() || null
    const descripcion = (formData.get('descripcion') as string)?.trim() || null
    const responsable_id = (formData.get('responsable_id') as string) || null

    if (!codigo || !nombre) {
      return { success: false, error: 'El código y el nombre del área son obligatorios' }
    }

    const adminSupabase = await createAdminClient()
    const { error } = await adminSupabase.from('areas').insert({
      codigo,
      nombre,
      centro_costo,
      descripcion,
      responsable_id: responsable_id || null,
      activa: true,
    })

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Ya existe un área con ese código o nombre' }
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/areas')
    revalidatePath('/solicitudes/nueva')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear el área' }
  }
}

export async function editarAreaAction(id: string, formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const codigo = (formData.get('codigo') as string)?.trim().toUpperCase()
    const nombre = (formData.get('nombre') as string)?.trim()
    const centro_costo = (formData.get('centro_costo') as string)?.trim() || null
    const descripcion = (formData.get('descripcion') as string)?.trim() || null
    const responsable_id = (formData.get('responsable_id') as string) || null

    if (!codigo || !nombre) {
      return { success: false, error: 'El código y el nombre son obligatorios' }
    }

    const adminSupabase = await createAdminClient()
    const { error } = await adminSupabase
      .from('areas')
      .update({
        codigo,
        nombre,
        centro_costo,
        descripcion,
        responsable_id: responsable_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Ya existe un área con ese código o nombre' }
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/areas')
    revalidatePath('/solicitudes/nueva')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al actualizar el área' }
  }
}

export async function toggleAreaAction(id: string, activa: boolean) {
  try {
    const adminSupabase = await createAdminClient()
    const { error } = await adminSupabase
      .from('areas')
      .update({ activa, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return { success: false, error: error.message }
    revalidatePath('/areas')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al cambiar estado' }
  }
}

export async function asignarUsuariosAreaAction(areaId: string, usuarioIds: string[]) {
  try {
    const adminSupabase = await createAdminClient()

    // Eliminar asignaciones actuales
    const { error: delError } = await adminSupabase
      .from('usuario_areas')
      .delete()
      .eq('area_id', areaId)

    if (delError) return { success: false, error: delError.message }

    // Insertar nuevas
    if (usuarioIds.length > 0) {
      const records = usuarioIds.map((uid) => ({
        area_id: areaId,
        usuario_id: uid,
      }))
      const { error: insError } = await adminSupabase.from('usuario_areas').insert(records)
      if (insError) return { success: false, error: insError.message }
    }

    revalidatePath('/areas')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al asignar usuarios' }
  }
}
