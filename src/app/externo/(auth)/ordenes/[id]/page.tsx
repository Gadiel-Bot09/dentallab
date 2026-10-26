// src/app/(externo)/ordenes/[id]/page.tsx
// Order detail for external lab — mobile-first with state actions
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { ORDEN_ESTADO_LABELS, ORDEN_ESTADO_COLORS, type OrdenEstado } from '@/types/database'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import LabEstadoActions from './_components/LabEstadoActions'
import LabUploadFoto from './_components/LabUploadFoto'
import TimelineEventos from '@/app/(interno)/ordenes/[id]/_components/TimelineEventos'
import Odontograma from '@/components/odontograma/Odontograma'

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return format(new Date(d), 'dd/MM/yyyy HH:mm', { locale: es })
}

export default async function ExternoOrdenDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/externo/login')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('id, rol, laboratorio_id, nombre, apellido')
    .eq('id', user.id)
    .single()

  if (!profile || profile.rol !== 'laboratorio') redirect('/externo/login')

  const { id } = await params

  const { data: orden } = await supabase
    .from('ordenes_servicio')
    .select(`
      *, 
      pacientes(nombre, apellido, cedula),
      odontologo:usuarios!odontologo_id(nombre, apellido)
    `)
    .eq('id', id)
    .eq('laboratorio_id', profile.laboratorio_id!)
    .single()

  if (!orden) notFound()

  const [{ data: eventos }, { data: documentos }] = await Promise.all([
    supabase
      .from('eventos_orden')
      .select('*, usuarios!actor_id(nombre, apellido)')
      .eq('orden_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('documentos_orden')
      .select('*')
      .eq('orden_id', id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <a href="/externo/ordenes" className="text-slate-500 hover:text-sky-400 text-sm transition-colors">← Mis órdenes</a>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-xl font-bold text-white">{orden.tipo_trabajo}</h1>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${ORDEN_ESTADO_COLORS[orden.estado as OrdenEstado]}`}>
            {ORDEN_ESTADO_LABELS[orden.estado as OrdenEstado]}
          </span>
        </div>
        <p className="text-sky-400 font-mono font-bold text-sm mt-1">{orden.radicado}</p>
      </div>

      {/* State Actions (lab-specific transitions) */}
      <LabEstadoActions
        ordenId={id}
        estadoActual={orden.estado as OrdenEstado}
        userId={profile.id}
        userNombre={`${profile.nombre} ${profile.apellido}`}
      />

      {/* Patient & Details */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-sm">
        <h2 className="font-semibold text-white text-xs uppercase tracking-wider">Detalles del Trabajo</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs w-28">Paciente:</span>
            <span className="text-slate-300">{(orden.pacientes as any)?.nombre} {(orden.pacientes as any)?.apellido}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs w-28">Odontólogo:</span>
            <span className="text-slate-300">Dr. {(orden.odontologo as any)?.nombre} {(orden.odontologo as any)?.apellido}</span>
          </div>
          {orden.fecha_estimada_entrega && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-xs w-28">Entrega estimada:</span>
              <span className="text-amber-400 font-medium">{fmtDate(orden.fecha_estimada_entrega)}</span>
            </div>
          )}
          {orden.descripcion && (
            <div>
              <span className="text-slate-500 text-xs">Descripción:</span>
              <p className="text-slate-300 mt-0.5">{orden.descripcion}</p>
            </div>
          )}
          {orden.observaciones_tecnicas && (
            <div>
              <span className="text-slate-500 text-xs">Observaciones técnicas:</span>
              <p className="text-slate-300 mt-0.5">{orden.observaciones_tecnicas}</p>
            </div>
          )}
        </div>
      </div>

      {/* Odontograma para el Laboratorio */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h2 className="font-semibold text-white text-xs uppercase tracking-wider flex items-center gap-2">
              <span>🦷</span>
              <span>Dientes a fabricar / reemplazar</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Piezas marcadas por la clínica para este trabajo protésico.
            </p>
          </div>
          {orden.denticion && (
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold capitalize">
              Dentición {orden.denticion}
            </span>
          )}
        </div>

        <Odontograma
          value={orden.piezas_dentales ?? []}
          readOnly
          tipoTrabajo={orden.tipo_trabajo}
        />
      </div>

      {/* Photo Upload */}
      <LabUploadFoto ordenId={id} documentos={documentos ?? []} />

      {/* Timeline */}
      <TimelineEventos eventos={eventos ?? []} />
    </div>
  )
}
