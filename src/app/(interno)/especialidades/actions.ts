'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearEspecialidad(formData: FormData) {
  try {
    const supabase = await createClient()

    const nombre = formData.get('nombre')?.toString()
    const descripcion = formData.get('descripcion')?.toString()

    if (!nombre) throw new Error('El nombre es requerido')

    const { error } = await supabase.from('especialidades').insert([{
      nombre,
      descripcion: descripcion || null,
      activa: true
    }])

    if (error) throw error

    revalidatePath('/especialidades')
    return { success: true }
  } catch (error: any) {
    console.error('Error al crear especialidad:', error)
    return { success: false, error: error.message }
  }
}

export async function toggleEspecialidad(id: string, activa: boolean) {
  try {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('especialidades')
      .update({ activa: !activa })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/especialidades')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
