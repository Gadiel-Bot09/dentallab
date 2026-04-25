'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const odontologoSchema = z.object({
  nombre: z.string().min(2, 'El nombre es requerido'),
  apellido: z.string().min(2, 'El apellido es requerido'),
  email: z.string().email('Correo inválido'),
  documento: z.string().min(5, 'El documento es requerido para generar la contraseña'),
  laboratorio_id: z.string().optional().nullable(),
  especialidad_id: z.string().optional().nullable(),
})

const getServiceSupabase = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false }
    }
  )
}

export async function crearOdontologoRapido(formData: FormData) {
  try {
    const supabaseAdmin = getServiceSupabase()

    const rawData = {
      nombre: formData.get('nombre'),
      apellido: formData.get('apellido'),
      email: formData.get('email'),
      documento: formData.get('documento'),
      laboratorio_id: formData.get('laboratorio_id') || null,
      especialidad_id: formData.get('especialidad_id') || null,
    }

    const validData = odontologoSchema.parse(rawData)

    // La contraseña es el mismo número de documento
    const password = validData.documento

    // 1. Crear usuario en Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: validData.email,
      password: password,
      email_confirm: true,
    })

    if (authError) throw authError
    if (!authData.user) throw new Error('No se pudo crear en Auth')

    // 2. Insertar en tabla pública
    const { error: dbError } = await supabaseAdmin.from('usuarios').insert({
      id: authData.user.id,
      email: validData.email,
      nombre: validData.nombre,
      apellido: validData.apellido,
      documento: validData.documento,
      rol: 'odontologo',
      laboratorio_id: validData.laboratorio_id,
      especialidad_id: validData.especialidad_id,
      activo: true,
    })

    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw dbError
    }

    revalidatePath('/odontologos')
    revalidatePath('/pacientes/nuevo')
    return { success: true, userId: authData.user.id }
  } catch (error: any) {
    console.error('Error al crear odontólogo:', error)
    return { success: false, error: error.message }
  }
}
