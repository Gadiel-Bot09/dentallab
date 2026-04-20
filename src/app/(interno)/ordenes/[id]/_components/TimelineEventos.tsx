// src/app/(interno)/ordenes/[id]/_components/TimelineEventos.tsx
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ORDEN_ESTADO_LABELS, type OrdenEstado } from '@/types/database'

interface Evento {
  id: string
  tipo_evento: string
  estado_anterior: OrdenEstado | null
  estado_nuevo: OrdenEstado | null
  descripcion: string | null
  actor_rol: string
  modo: string
  created_at: string
  usuarios?: { nombre: string; apellido: string } | null
}

const TIPO_ICON: Record<string, string> = {
  'orden.creada': '✨',
  'estado_cambiado': '🔄',
  'material_agregado': '📦',
  'documento_adjunto': '📎',
  'correo_enviado': '📧',
}

export default function TimelineEventos({ eventos }: { eventos: Evento[] }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <h2 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Historial / Timeline</h2>

      {eventos.length === 0 ? (
        <p className="text-slate-600 text-sm text-center py-4">Sin eventos registrados</p>
      ) : (
        <div className="space-y-0">
          {eventos.map((ev, idx) => (
            <div key={ev.id} className="flex gap-3">
              {/* Line */}
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shrink-0 z-10">
                  {TIPO_ICON[ev.tipo_evento] ?? '📌'}
                </div>
                {idx < eventos.length - 1 && (
                  <div className="w-px bg-slate-800 flex-1 min-h-[20px] my-1" />
                )}
              </div>

              {/* Content */}
              <div className="pb-5 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs text-slate-500">
                    {format(new Date(ev.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${ev.modo === 'portal_externo' ? 'bg-violet-500/10 text-violet-400' : 'bg-slate-700 text-slate-400'}`}>
                    {ev.modo === 'portal_externo' ? '🔬 Lab' : '🏥 Interno'}
                  </span>
                </div>

                {ev.estado_anterior && ev.estado_nuevo && (
                  <p className="text-slate-300 text-xs flex items-center gap-1">
                    <span className="text-slate-600">{ORDEN_ESTADO_LABELS[ev.estado_anterior]}</span>
                    <span className="text-slate-600">→</span>
                    <span className="text-sky-400 font-medium">{ORDEN_ESTADO_LABELS[ev.estado_nuevo]}</span>
                  </p>
                )}

                {ev.descripcion && (
                  <p className="text-slate-400 text-xs mt-0.5">{ev.descripcion}</p>
                )}

                <p className="text-slate-600 text-xs mt-0.5">
                  Por: {ev.usuarios ? `${ev.usuarios.nombre} ${ev.usuarios.apellido}` : 'Sistema'} ({ev.actor_rol})
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
