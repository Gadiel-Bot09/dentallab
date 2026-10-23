'use server'
// src/app/(interno)/farmacias/actions.ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearFarmaciaAction(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const codigo = (formData.get('codigo') as string)?.trim().toUpperCase()
    const nombre = (formData.get('nombre') as string)?.trim()
    const ubicacion = (formData.get('ubicacion') as string)?.trim() || null
    const descripcion = (formData.get('descripcion') as string)?.trim() || null
    const responsable_id = (formData.get('responsable_id') as string) || null

    if (!codigo || !nombre) {
      return { success: false, error: 'El código y el nombre de la farmacia son obligatorios' }
    }

    const adminSupabase = await createAdminClient()
    const { error } = await adminSupabase.from('farmacias').insert({
      codigo,
      nombre,
      ubicacion,
      descripcion,
      responsable_id: responsable_id || null,
      activa: true,
    })

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Ya existe una farmacia con ese código o nombre' }
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/farmacias')
    revalidatePath('/farmacia/stock')
    revalidatePath('/solicitudes/nueva')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear la farmacia' }
  }
}

export async function editarFarmaciaAction(id: string, formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const codigo = (formData.get('codigo') as string)?.trim().toUpperCase()
    const nombre = (formData.get('nombre') as string)?.trim()
    const ubicacion = (formData.get('ubicacion') as string)?.trim() || null
    const descripcion = (formData.get('descripcion') as string)?.trim() || null
    const responsable_id = (formData.get('responsable_id') as string) || null

    if (!codigo || !nombre) {
      return { success: false, error: 'El código y el nombre son obligatorios' }
    }

    const adminSupabase = await createAdminClient()
    const { error } = await adminSupabase
      .from('farmacias')
      .update({
        codigo,
        nombre,
        ubicacion,
        descripcion,
        responsable_id: responsable_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Ya existe una farmacia con ese código o nombre' }
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/farmacias')
    revalidatePath('/farmacia/stock')
    revalidatePath('/solicitudes/nueva')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al actualizar la farmacia' }
  }
}

export async function toggleFarmaciaAction(id: string, activa: boolean) {
  try {
    const adminSupabase = await createAdminClient()
    const { error } = await adminSupabase
      .from('farmacias')
      .update({ activa, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return { success: false, error: error.message }
    revalidatePath('/farmacias')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al cambiar estado' }
  }
}

export async function asignarUsuariosFarmaciaAction(farmaciaId: string, usuarioIds: string[]) {
  try {
    const adminSupabase = await createAdminClient()

    const { error: delError } = await adminSupabase
      .from('usuario_farmacias')
      .delete()
      .eq('farmacia_id', farmaciaId)

    if (delError) return { success: false, error: delError.message }

    if (usuarioIds.length > 0) {
      const records = usuarioIds.map((uid) => ({
        farmacia_id: farmaciaId,
        usuario_id: uid,
      }))
      const { error: insError } = await adminSupabase.from('usuario_farmacias').insert(records)
      if (insError) return { success: false, error: insError.message }
    }

    revalidatePath('/farmacias')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al asignar usuarios a farmacia' }
  }
}
