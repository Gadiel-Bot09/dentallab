// src/app/(interno)/layout.tsx
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from './_components/Sidebar'
import Topbar from './_components/Topbar'

export default async function InternoLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('id, nombre, apellido, rol, email')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <Sidebar userRol={profile.rol} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar user={profile} />
        <main className="flex-1 overflow-y-auto bg-slate-950 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
