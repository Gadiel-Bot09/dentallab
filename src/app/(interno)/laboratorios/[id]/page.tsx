// src/app/(interno)/laboratorios/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import LaboratorioForm from '../_components/LaboratorioForm'

export const metadata: Metadata = {
  title: 'Editar Laboratorio — DentalLab Manager',
}

export default async function EditarLaboratorioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (profile?.rol !== 'admin') redirect('/dashboard')

  const { id } = await params

  const { data: laboratorio } = await supabase
    .from('laboratorios')
    .select('*')
    .eq('id', id)
    .single()

  if (!laboratorio) notFound()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <a href="/laboratorios" className="text-slate-500 hover:text-sky-400 text-sm transition-colors">← Volver a Laboratorios</a>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-white">Editar Laboratorio: {laboratorio.nombre}</h1>
        <p className="text-slate-400 text-sm mt-1">Actualice los datos o el estado del portal para esta entidad.</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8">
        <LaboratorioForm initialData={laboratorio} />
      </div>
    </div>
  )
}
