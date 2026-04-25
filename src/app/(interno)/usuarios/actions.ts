'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const usuarioSchema = z.object({
  nombre: z.string().min(2, 'El nombre es requerido'),
  apellido: z.string().min(2, 'El apellido es requerido'),
  email: z.string().email('Correo inválido'),
  rol: z.enum(['admin', 'odontologo', 'auxiliar', 'recepcionista', 'laboratorio']),
  laboratorio_id: z.string().uuid().optional().nullable(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

// Usamos el Service Role para poder crear usuarios en Auth sin estar logueados como ellos
const getServiceSupabase = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

export async function crearUsuario(formData: FormData) {
  try {
    const supabaseAdmin = getServiceSupabase()

    const rawData = {
      nombre: formData.get('nombre'),
      apellido: formData.get('apellido'),
      email: formData.get('email'),
      rol: formData.get('rol'),
      laboratorio_id: formData.get('laboratorio_id') || null,
      password: formData.get('password'),
    }

    const validData = usuarioSchema.parse(rawData)

    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: validData.email,
      password: validData.password,
      email_confirm: true, // Auto confirmar
    })

    if (authError) throw authError

    if (!authData.user) throw new Error('No se pudo crear el usuario en Auth')

    // 2. Insertar en la tabla pública de usuarios
    const { error: dbError } = await supabaseAdmin.from('usuarios').insert({
      id: authData.user.id,
      email: validData.email,
      nombre: validData.nombre,
      apellido: validData.apellido,
      rol: validData.rol,
      laboratorio_id: validData.laboratorio_id,
      activo: true,
    })

    if (dbError) {
      // Intentar limpiar el auth si falla la DB
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw dbError
    }

    revalidatePath('/usuarios')
    return { success: true }
  } catch (error: any) {
    console.error('Error al crear usuario:', error)
    return { success: false, error: error.message }
  }
}

export async function toggleEstadoUsuario(id: string, estadoActual: boolean) {
  try {
    const supabaseAdmin = getServiceSupabase()
    
    const { error } = await supabaseAdmin
      .from('usuarios')
      .update({ activo: !estadoActual })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/usuarios')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
