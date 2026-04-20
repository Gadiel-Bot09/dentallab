// src/app/(externo)/layout.tsx
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ExternoNavbar from './_components/ExternoNavbar'

export default async function ExternoLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/externo/login')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('id, nombre, apellido, rol, email, laboratorio_id, laboratorios(nombre)')
    .eq('id', user.id)
    .single()

  if (!profile || profile.rol !== 'laboratorio') redirect('/externo/login')

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <ExternoNavbar user={profile} labNombre={(profile.laboratorios as any)?.nombre ?? 'Laboratorio'} />
      <main className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
