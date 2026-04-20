// src/app/(interno)/ordenes/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ORDEN_ESTADO_LABELS, ORDEN_ESTADO_COLORS } from '@/types/database'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import CambiarEstadoPanel from './_components/CambiarEstadoPanel'
import TimelineEventos from './_components/TimelineEventos'
import DocumentosPanel from './_components/DocumentosPanel'

export const metadata: Metadata = {
  title: 'Detalle de Orden — DentalLab Manager',
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return format(new Date(d), 'dd/MM/yyyy HH:mm', { locale: es })
}

function fmtCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
}

export default async function OrdenDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const { data: orden } = await supabase
    .from('ordenes_servicio')
    .select(`
      *, 
      pacientes(nombre, apellido, cedula, numero_historia, telefono),
      laboratorios(nombre, contacto, email, telefono),
      odontologo:usuarios!odontologo_id(nombre, apellido, email),
      registrado_por:usuarios!registrado_por_id(nombre, apellido)
    `)
    .eq('id', id)
    .single()

  if (!orden) notFound()

  const [{ data: materiales }, { data: eventos }, { data: documentos }, { data: profile }] =
    await Promise.all([
      supabase
        .from('orden_materiales')
        .select('*, inventario(nombre, codigo, unidad_medida)')
        .eq('orden_id', id),
      supabase
        .from('eventos_orden')
        .select('*, usuarios!actor_id(nombre, apellido)')
        .eq('orden_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('documentos_orden')
        .select('*, usuarios!subido_por_id(nombre, apellido)')
        .eq('orden_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('usuarios')
        .select('id, rol, nombre, apellido')
        .eq('id', user.id)
        .single(),
    ])

  const isLab = profile?.rol === 'laboratorio'

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <a href="/ordenes" className="text-slate-500 hover:text-sky-400 text-sm transition-colors">← Órdenes</a>
            <span className="text-slate-700">/</span>
            <span className="font-mono text-sky-400 font-bold">{orden.radicado}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{orden.tipo_trabajo}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium ${ORDEN_ESTADO_COLORS[orden.estado as keyof typeof ORDEN_ESTADO_COLORS]}`}>
              {ORDEN_ESTADO_LABELS[orden.estado as keyof typeof ORDEN_ESTADO_LABELS]}
            </span>
            <span className="text-slate-500 text-sm">{fmtDate(orden.fecha_creacion)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="xl:col-span-2 space-y-5">
          {/* Patient & Professionals */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Información Clínica</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Paciente</p>
                <p className="text-white font-medium">{(orden.pacientes as any)?.nombre} {(orden.pacientes as any)?.apellido}</p>
                <p className="text-slate-500 text-xs">Historia: {(orden.pacientes as any)?.numero_historia} · CC: {(orden.pacientes as any)?.cedula}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Odontólogo</p>
                <p className="text-white font-medium">{(orden.odontologo as any)?.nombre} {(orden.odontologo as any)?.apellido}</p>
                <p className="text-slate-500 text-xs">{(orden.odontologo as any)?.email}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Laboratorio</p>
                <p className="text-white font-medium">{(orden.laboratorios as any)?.nombre}</p>
                <p className="text-slate-500 text-xs">{(orden.laboratorios as any)?.email}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Registrado por</p>
                <p className="text-white">{(orden.registrado_por as any)?.nombre} {(orden.registrado_por as any)?.apellido}</p>
              </div>
            </div>
            {orden.descripcion && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <p className="text-slate-500 text-xs mb-1">Descripción</p>
                <p className="text-slate-300 text-sm">{orden.descripcion}</p>
              </div>
            )}
            {orden.observaciones_tecnicas && (
              <div className="mt-3">
                <p className="text-slate-500 text-xs mb-1">Observaciones técnicas</p>
                <p className="text-slate-300 text-sm">{orden.observaciones_tecnicas}</p>
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Trazabilidad de Fechas</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {[
                { label: 'Creación', value: fmtDate(orden.fecha_creacion) },
                { label: 'Env. al Lab', value: fmtDate(orden.fecha_envio_lab) },
                { label: 'Recibido Lab', value: fmtDate(orden.fecha_recibido_lab) },
                { label: 'Entrega estimada', value: fmtDate(orden.fecha_estimada_entrega), highlight: true },
                { label: 'Env. al Centro', value: fmtDate(orden.fecha_enviada_centro) },
                { label: 'Recibido Centro', value: fmtDate(orden.fecha_recibida_centro) },
              ].map((item) => (
                <div key={item.label} className="bg-slate-800/60 rounded-xl p-3">
                  <p className="text-slate-500 text-xs">{item.label}</p>
                  <p className={`font-medium text-xs mt-0.5 ${item.highlight ? 'text-amber-400' : 'text-slate-300'}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Materials */}
          {materiales && materiales.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Materiales Utilizados</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left">
                    <th className="pb-2 text-slate-500 font-medium text-xs">Material</th>
                    <th className="pb-2 text-slate-500 font-medium text-xs">Cantidad</th>
                    <th className="pb-2 text-slate-500 font-medium text-xs">Costo u. (momento)</th>
                    <th className="pb-2 text-slate-500 font-medium text-xs text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {materiales.map((m: any) => (
                    <tr key={m.id}>
                      <td className="py-2 text-slate-300">{m.inventario?.nombre}<span className="text-slate-600 text-xs ml-1">({m.inventario?.codigo})</span></td>
                      <td className="py-2 text-slate-400">{m.cantidad_usada} {m.inventario?.unidad_medida}</td>
                      <td className="py-2 text-slate-400">{fmtCOP(m.costo_unitario_momento)}</td>
                      <td className="py-2 text-white text-right font-mono">{fmtCOP(m.cantidad_usada * m.costo_unitario_momento)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-700">
                    <td colSpan={3} className="pt-3 text-slate-400 text-right text-xs">Total Costo Materiales:</td>
                    <td className="pt-3 text-white font-bold text-right font-mono">{fmtCOP(orden.costo_total_materiales)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Financials */}
          {!isLab && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Rentabilidad</h2>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-slate-800/60 rounded-xl p-3">
                  <p className="text-slate-500 text-xs">Costo materiales</p>
                  <p className="text-red-400 font-bold mt-0.5">{fmtCOP(orden.costo_total_materiales)}</p>
                </div>
                <div className="bg-slate-800/60 rounded-xl p-3">
                  <p className="text-slate-500 text-xs">Precio venta</p>
                  <p className="text-emerald-400 font-bold mt-0.5">{fmtCOP(orden.precio_venta)}</p>
                </div>
                <div className="bg-slate-800/60 rounded-xl p-3">
                  <p className="text-slate-500 text-xs">Margen bruto</p>
                  <p className={`font-bold mt-0.5 ${orden.margen_ganancia >= 30 ? 'text-emerald-400' : orden.margen_ganancia >= 15 ? 'text-amber-400' : 'text-red-400'}`}>
                    {orden.margen_ganancia.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Documents */}
          <DocumentosPanel documentos={documentos ?? []} ordenId={id} />
        </div>

        {/* Side panels */}
        <div className="space-y-5">
          {/* State transition */}
          <CambiarEstadoPanel
            ordenId={id}
            estadoActual={orden.estado}
            userRol={profile?.rol ?? 'auxiliar'}
            modoGestionActual={orden.modo_gestion}
          />

          {/* Timeline */}
          <TimelineEventos eventos={eventos ?? []} />
        </div>
      </div>
    </div>
  )
}
