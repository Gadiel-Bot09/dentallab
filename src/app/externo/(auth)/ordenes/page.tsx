// src/app/(externo)/ordenes/page.tsx
// Mobile-first view for laboratory users — shows their assigned orders
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ORDEN_ESTADO_LABELS, ORDEN_ESTADO_COLORS, type OrdenEstado } from '@/types/database'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const metadata: Metadata = {
  title: 'Mis Órdenes — DentalLab Manager',
}

export default async function ExternoOrdenesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/externo/login')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('id, rol, laboratorio_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.rol !== 'laboratorio') redirect('/externo/login')

  const { data: ordenes } = await supabase
    .from('ordenes_servicio')
    .select(`
      id, radicado, tipo_trabajo, estado, fecha_estimada_entrega,
      fecha_creacion, descripcion, observaciones_tecnicas,
      pacientes(nombre, apellido),
      odontologo:usuarios!odontologo_id(nombre, apellido)
    `)
    .eq('laboratorio_id', profile.laboratorio_id!)
    .not('estado', 'in', '(entregada_paciente,cancelada)')
    .order('created_at', { ascending: false })

  function isOverdue(o: any): boolean {
    if (!o.fecha_estimada_entrega) return false
    return new Date(o.fecha_estimada_entrega) < new Date()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Mis Órdenes</h1>
        <p className="text-slate-400 text-sm">{ordenes?.length ?? 0} orden(es) activa(s)</p>
      </div>

      {!ordenes || ordenes.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
          <p className="text-4xl mb-3">📋</p>
          <p>No tienes órdenes activas asignadas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ordenes.map((orden: any) => {
            const overdue = isOverdue(orden)
            return (
              <Link
                key={orden.id}
                href={`/externo/ordenes/${orden.id}`}
                className={`block bg-slate-900 border rounded-2xl p-5 hover:border-slate-600 transition-all ${
                  overdue ? 'border-red-500/30' : 'border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-mono text-sky-400 font-bold text-sm">{orden.radicado}</p>
                    <p className="text-white font-semibold mt-0.5">{orden.tipo_trabajo}</p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${ORDEN_ESTADO_COLORS[orden.estado as OrdenEstado]}`}>
                    {ORDEN_ESTADO_LABELS[orden.estado as OrdenEstado]}
                  </span>
                </div>

                <div className="text-sm text-slate-400 space-y-1">
                  <p>👤 {orden.pacientes?.nombre} {orden.pacientes?.apellido}</p>
                  <p>🦷 Dr. {orden.odontologo?.nombre} {orden.odontologo?.apellido}</p>
                  {orden.fecha_estimada_entrega && (
                    <p className={overdue ? 'text-red-400 font-medium' : ''}>
                      📅 Entrega: {format(new Date(orden.fecha_estimada_entrega), 'dd/MM/yyyy', { locale: es })}
                      {overdue && ' ⚠ DEMORADA'}
                    </p>
                  )}
                </div>

                {orden.observaciones_tecnicas && (
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <p className="text-xs text-slate-500 mb-1">Notas técnicas:</p>
                    <p className="text-xs text-slate-400 line-clamp-2">{orden.observaciones_tecnicas}</p>
                  </div>
                )}

                <p className="text-right text-xs text-slate-600 mt-3">Ver detalle →</p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
