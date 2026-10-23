// src/app/(interno)/areas/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import type { Area, Usuario } from '@/types/database'
import AreaList from './_components/AreaList'

export const metadata: Metadata = {
  title: 'Áreas de la Institución — DentalLab Manager',
}

export default async function AreasPage() {
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

  // Cargar áreas con su responsable y usuarios asignados
  const { data: areasData } = await adminSupabase
    .from('areas')
    .select(`
      *,
      responsable:responsable_id(id, nombre, apellido, email, rol),
      usuarios_asignados:usuario_areas(
        usuario_id,
        usuario:usuario_id(id, nombre, apellido, email, rol)
      )
    `)
    .order('nombre')

  // Cargar lista de usuarios internos activos para asignar
  const { data: usuariosData } = await adminSupabase
    .from('usuarios')
    .select('id, nombre, apellido, email, rol, activo, laboratorio_id, created_at, updated_at')
    .eq('activo', true)
    .order('nombre')

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Áreas de la Institución</h1>
        <p className="text-slate-400 text-sm mt-1">
          Configura las áreas asistenciales, centros de costo y departamentos que solicitan insumos a farmacia.
        </p>
      </div>

      <AreaList
        initialAreas={(areasData as unknown as Area[]) || []}
        usuarios={(usuariosData as unknown as Usuario[]) || []}
      />
    </div>
  )
}
