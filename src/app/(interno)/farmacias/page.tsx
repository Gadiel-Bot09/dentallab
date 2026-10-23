// src/app/(interno)/farmacias/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import type { Farmacia, Usuario } from '@/types/database'
import FarmaciaList from './_components/FarmaciaList'

export const metadata: Metadata = {
  title: 'Farmacias y Bodegas — DentalLab Manager',
}

export default async function FarmaciasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (profile?.rol !== 'admin') redirect('/dashboard')

  const adminSupabase = await createAdminClient()

  const { data: farmaciasData } = await adminSupabase
    .from('farmacias')
    .select(`
      *,
      responsable:responsable_id(id, nombre, apellido, email, rol),
      usuarios_asignados:usuario_farmacias(
        usuario_id,
        usuario:usuario_id(id, nombre, apellido, email, rol)
      )
    `)
    .order('nombre')

  const { data: usuariosData } = await adminSupabase
    .from('usuarios')
    .select('id, nombre, apellido, email, rol, activo, laboratorio_id, created_at, updated_at')
    .eq('activo', true)
    .order('nombre')

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Farmacias y Bodegas de Insumos</h1>
        <p className="text-slate-400 text-sm mt-1">
          Gestiona las farmacias y bodegas centrales de la institución desde donde se despachan insumos a las distintas áreas.
        </p>
      </div>

      <FarmaciaList
        initialFarmacias={(farmaciasData as unknown as Farmacia[]) || []}
        usuarios={(usuariosData as unknown as Usuario[]) || []}
      />
    </div>
  )
}
