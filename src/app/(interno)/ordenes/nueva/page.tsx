// src/app/(interno)/ordenes/nueva/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import NuevaOrdenForm from './_components/NuevaOrdenForm'

export const metadata: Metadata = {
  title: 'Nueva Orden — DentalLab Manager',
}

export default async function NuevaOrdenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: pacientes },
    { data: odontologos },
    { data: laboratorios },
    { data: inventario },
    { data: especialidades },
  ] = await Promise.all([
    supabase
      .from('pacientes')
      .select('id, nombre, apellido, numero_historia, cedula')
      .order('apellido'),
    supabase
      .from('usuarios')
      .select('id, nombre, apellido')
      .eq('rol', 'odontologo')
      .eq('activo', true)
      .order('apellido'),
    supabase
      .from('laboratorios')
      .select('id, nombre')
      .order('nombre'),
    supabase
      .from('inventario')
      .select('id, codigo, nombre, unidad_medida, precio_unitario, stock_actual')
      .eq('activo', true)
      .gt('stock_actual', 0)
      .order('nombre'),
    supabase
      .from('especialidades')
      .select('id, nombre')
      .eq('activa', true)
      .order('nombre'),
  ])

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Nueva Orden de Servicio</h1>
        <p className="text-slate-400 text-sm mt-1">
          Complete los datos del trabajo protésico a encargar al laboratorio.
        </p>
      </div>
      <NuevaOrdenForm
        pacientes={pacientes ?? []}
        initialOdontologos={odontologos ?? []}
        laboratorios={laboratorios ?? []}
        inventario={inventario ?? []}
        especialidades={especialidades ?? []}
      />
    </div>
  )
}
