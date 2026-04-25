// src/app/(interno)/usuarios/nuevo/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import UsuarioForm from '../_components/UsuarioForm'

export const metadata: Metadata = {
  title: 'Nuevo Usuario — DentalLab Manager',
}

export default async function NuevoUsuarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (profile?.rol !== 'admin') redirect('/dashboard')

  // Obtener la lista de clínicas/laboratorios para asignación (en caso de crear un usuario externo)
  const { data: laboratorios } = await supabase
    .from('laboratorios')
    .select('id, nombre')
    .order('nombre')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <a href="/usuarios" className="text-slate-500 hover:text-sky-400 text-sm transition-colors">← Volver a Usuarios</a>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-white">Registrar Nuevo Usuario</h1>
        <p className="text-slate-400 text-sm mt-1">Cree una cuenta para empleados del laboratorio o para clientes de clínicas externas.</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8">
        <UsuarioForm laboratorios={laboratorios || []} />
      </div>
    </div>
  )
}
