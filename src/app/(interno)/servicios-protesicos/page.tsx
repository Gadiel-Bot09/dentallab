// src/app/(interno)/servicios-protesicos/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import ServicioForm from './_components/ServicioForm'

export const metadata: Metadata = {
  title: 'Servicios Protésicos — DentalLab Manager',
}

export default async function ServiciosProtesicosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (profile?.rol !== 'admin') redirect('/dashboard')

  const { data: servicios } = await supabase
    .from('servicios_protesicos')
    .select('*')
    .order('nombre')

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Catálogo de Servicios Protésicos</h1>
        <p className="text-slate-400 text-sm mt-1">
          Gestiona los tipos de trabajo que se ofrecen en el laboratorio.
        </p>
      </div>

      <ServicioForm servicios={servicios ?? []} />
    </div>
  )
}
