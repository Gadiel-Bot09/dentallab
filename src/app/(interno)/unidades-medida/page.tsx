// src/app/(interno)/unidades-medida/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import UnidadMedidaForm from './_components/UnidadMedidaForm'

export const metadata: Metadata = {
  title: 'Unidades de Medida — DentalLab Manager',
}

export default async function UnidadesMedidaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (profile?.rol !== 'admin') redirect('/dashboard')

  const { data: unidades } = await supabase
    .from('unidades_medida')
    .select('*')
    .order('nombre')

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Unidades de Medida</h1>
        <p className="text-slate-400 text-sm mt-1">
          Gestiona las unidades en las que mides tu inventario (gramos, unidades, cajas, etc.).
        </p>
      </div>

      <UnidadMedidaForm unidades={unidades ?? []} />
    </div>
  )
}
