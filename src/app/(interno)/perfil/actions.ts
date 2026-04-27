'use server'
// src/app/(interno)/perfil/actions.ts
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function actualizarPerfilAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')

  const nombre = formData.get('nombre') as string
  const apellido = formData.get('apellido') as string

  if (!nombre || !apellido) throw new Error('Nombre y apellido son requeridos')

  const { error } = await supabase
    .from('usuarios')
    .update({ nombre, apellido })
    .eq('id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/perfil')
  revalidatePath('/dashboard')
}

export async function cambiarPasswordAction(formData: FormData) {
  const supabase = await createClient()
  
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (password !== confirmPassword) {
    throw new Error('Las contraseñas no coinciden')
  }

  if (password.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres')
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) throw new Error(error.message)
}
