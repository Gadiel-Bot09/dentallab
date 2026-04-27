// src/app/(interno)/perfil/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import PerfilForm from './_components/PerfilForm'

export const metadata: Metadata = {
  title: 'Mi Perfil — DentalLab Manager',
}

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('nombre, apellido, email, rol')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mi Perfil</h1>
        <p className="text-slate-400 text-sm mt-1">Gestiona tu información personal y configuración de seguridad.</p>
      </div>

      <PerfilForm usuario={profile} />
    </div>
  )
}
