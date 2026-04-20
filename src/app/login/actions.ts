'use server'
// src/app/login/actions.ts
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { registrarAuditLog } from '@/lib/audit/logger'

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return redirect('/login?error=credenciales_invalidas')
  }

  // Get user profile to determine redirect
  const { data: profile } = await supabase
    .from('usuarios')
    .select('rol, activo')
    .eq('id', data.user.id)
    .single()

  if (!profile || !profile.activo) {
    await supabase.auth.signOut()
    return redirect('/login?error=usuario_inactivo')
  }

  // Audit login
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? null

  await registrarAuditLog({
    usuario_id: data.user.id,
    rol: profile.rol,
    accion: 'auth.login',
    entidad: 'usuarios',
    entidad_id: data.user.id,
    ip_address: ip,
    metadata: { email: data.user.email },
  })

  const roleHome: Record<string, string> = {
    admin: '/dashboard',
    odontologo: '/dashboard',
    auxiliar: '/dashboard',
    recepcionista: '/dashboard',
    laboratorio: '/externo/ordenes',
  }

  redirect(roleHome[profile.rol] ?? '/dashboard')
}

export async function logoutAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for') ?? null

    await registrarAuditLog({
      usuario_id: user.id,
      rol: profile?.rol ?? 'unknown',
      accion: 'auth.logout',
      entidad: 'usuarios',
      entidad_id: user.id,
      ip_address: ip,
      metadata: {},
    })
  }

  await supabase.auth.signOut()
  redirect('/login')
}
