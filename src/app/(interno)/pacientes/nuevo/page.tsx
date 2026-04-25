// src/app/(interno)/pacientes/nuevo/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import NuevoPacienteForm from './_components/NuevoPacienteForm'

export const metadata: Metadata = {
  title: 'Nuevo Paciente — DentalLab Manager',
}

export default async function NuevoPacientePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (profile?.rol === 'laboratorio') redirect('/dashboard')

  // Get available dentists for dropdown
  const { data: odontologos } = await supabase
    .from('usuarios')
    .select('id, nombre, apellido')
    .eq('rol', 'odontologo')
    .eq('activo', true)
    .order('apellido')

  const { data: especialidades } = await supabase.from('especialidades').select('id, nombre').eq('activa', true).order('nombre')
  const { data: laboratorios } = await supabase.from('laboratorios').select('id, nombre').order('nombre')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <a href="/pacientes" className="text-slate-500 hover:text-sky-400 text-sm transition-colors">← Volver a Pacientes</a>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-white">Registrar Nuevo Paciente</h1>
        <p className="text-slate-400 text-sm mt-1">Complete los datos del paciente para generar su historia clínica.</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8">
        <NuevoPacienteForm 
          initialOdontologos={odontologos ?? []} 
          especialidades={especialidades ?? []}
          laboratorios={laboratorios ?? []}
        />
      </div>
    </div>
  )
}
