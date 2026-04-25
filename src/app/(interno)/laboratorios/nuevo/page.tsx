// src/app/(interno)/laboratorios/nuevo/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import LaboratorioForm from '../_components/LaboratorioForm'

export const metadata: Metadata = {
  title: 'Nuevo Laboratorio — DentalLab Manager',
}

export default async function NuevoLaboratorioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (profile?.rol !== 'admin') redirect('/dashboard')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <a href="/laboratorios" className="text-slate-500 hover:text-sky-400 text-sm transition-colors">← Volver a Laboratorios</a>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-white">Registrar Nuevo Laboratorio / Clínica</h1>
        <p className="text-slate-400 text-sm mt-1">Complete los datos de la clínica externa o laboratorio aliado.</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8">
        <LaboratorioForm />
      </div>
    </div>
  )
}
