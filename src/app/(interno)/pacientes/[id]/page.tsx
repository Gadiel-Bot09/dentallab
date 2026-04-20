// src/app/(interno)/pacientes/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { ORDEN_ESTADO_COLORS, ORDEN_ESTADO_LABELS, type OrdenEstado } from '@/types/database'

export const metadata: Metadata = {
  title: 'Detalle de Paciente — DentalLab Manager',
}

export default async function PacienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const { data: paciente } = await supabase
    .from('pacientes')
    .select(`
      *,
      usuarios!odontologo_id(nombre, apellido)
    `)
    .eq('id', id)
    .single()

  if (!paciente) notFound()

  const { data: ordenes } = await supabase
    .from('ordenes_servicio')
    .select('id, radicado, tipo_trabajo, estado, fecha_creacion, laboratorios(nombre)')
    .eq('paciente_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <a href="/pacientes" className="text-slate-500 hover:text-sky-400 text-sm transition-colors">← Volver a Pacientes</a>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{paciente.nombre} {paciente.apellido}</h1>
            <span className="bg-sky-500/20 text-sky-400 px-3 py-1 rounded-lg text-sm font-mono font-bold">
              {paciente.numero_historia}
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">Registrado el {format(new Date(paciente.created_at), 'dd/MM/yyyy')}</p>
        </div>
        <button
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors"
          disabled
        >
          Editar Datos (Próximamente)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-5">Datos Personales</h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs">Cédula</p>
              <p className="font-mono text-slate-300 mt-0.5">{paciente.cedula}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Teléfono</p>
              <p className="text-slate-300 mt-0.5">{paciente.telefono ?? 'No registrado'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Correo Electrónico</p>
              <p className="text-slate-300 mt-0.5">{paciente.email ?? 'No registrado'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Fecha de Nacimiento</p>
              <p className="text-slate-300 mt-0.5">
                {paciente.fecha_nacimiento ? format(new Date(paciente.fecha_nacimiento), 'dd/MM/yyyy') : 'No registrada'}
              </p>
            </div>
            <div className="pt-4 border-t border-slate-800">
              <p className="text-slate-500 text-xs">Odontólogo Tratante</p>
              <p className="text-white font-medium mt-0.5">
                {paciente.usuarios ? `Dr(a). ${paciente.usuarios.nombre} ${paciente.usuarios.apellido}` : 'Sin asignar'}
              </p>
            </div>
          </div>
        </div>

        {/* History / Orders */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Historial de Trabajos Protésicos</h2>
            <Link
              href={`/ordenes/nueva?paciente_id=${id}`}
              className="text-sky-400 hover:text-sky-300 text-sm font-medium transition-colors"
            >
              + Nueva Orden
            </Link>
          </div>

          {!ordenes || ordenes.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-slate-500 text-sm">Este paciente no tiene órdenes de servicio asociadas.</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800">
              {ordenes.map(orden => (
                <div key={orden.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="font-mono text-sky-400 font-bold text-sm">{orden.radicado}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${ORDEN_ESTADO_COLORS[orden.estado as OrdenEstado]}`}>
                        {ORDEN_ESTADO_LABELS[orden.estado as OrdenEstado]}
                      </span>
                    </div>
                    <p className="text-white font-medium mt-1">{orden.tipo_trabajo}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      Lab: {(orden.laboratorios as any)?.nombre ?? 'No asignado'} · Fecha: {format(new Date(orden.fecha_creacion), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <Link
                    href={`/ordenes/${orden.id}`}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-xl transition-colors shrink-0"
                  >
                    Ver Detalle
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
