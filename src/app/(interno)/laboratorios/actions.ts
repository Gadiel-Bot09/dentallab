'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const laboratorioSchema = z.object({
  nombre: z.string().min(2, 'El nombre es requerido'),
  contacto: z.string().optional().nullable(),
  email: z.string().email('Email inválido').optional().or(z.literal('')).nullable(),
  telefono: z.string().optional().nullable(),
  portal_activo: z.boolean().default(false),
})

export async function crearLaboratorio(formData: FormData) {
  try {
    const supabase = await createClient()

    const rawData = {
      nombre: formData.get('nombre'),
      contacto: formData.get('contacto'),
      email: formData.get('email'),
      telefono: formData.get('telefono'),
      portal_activo: formData.get('portal_activo') === 'true',
    }

    const validData = laboratorioSchema.parse(rawData)

    const { error } = await supabase.from('laboratorios').insert([validData])

    if (error) throw error

    revalidatePath('/laboratorios')
    return { success: true }
  } catch (error: any) {
    console.error('Error al crear laboratorio:', error)
    return { success: false, error: error.message }
  }
}

export async function actualizarLaboratorio(id: string, formData: FormData) {
  try {
    const supabase = await createClient()

    const rawData = {
      nombre: formData.get('nombre'),
      contacto: formData.get('contacto'),
      email: formData.get('email'),
      telefono: formData.get('telefono'),
      portal_activo: formData.get('portal_activo') === 'true',
    }

    const validData = laboratorioSchema.parse(rawData)

    const { error } = await supabase.from('laboratorios').update(validData).eq('id', id)

    if (error) throw error

    revalidatePath('/laboratorios')
    revalidatePath(`/laboratorios/${id}`)
    return { success: true }
  } catch (error: any) {
    console.error('Error al actualizar laboratorio:', error)
    return { success: false, error: error.message }
  }
}
