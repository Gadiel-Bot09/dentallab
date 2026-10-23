// src/app/(interno)/devoluciones/[id]/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  DEVOLUCION_ESTADO_LABELS,
  DEVOLUCION_ESTADO_COLORS,
  DEVOLUCION_MOTIVO_LABELS,
  type Devolucion,
  type DevolucionEstado,
  type DevolucionMotivo,
} from '@/types/farmacia'
import DevolucionDetalleClient from './_components/DevolucionDetalleClient'

export const metadata: Metadata = {
  title: 'Detalle de Devolución — DentalLab Manager',
}

interface PageProps {
  params: Promise<{ id: string }>
}

function fmtCOP(v: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(v || 0)
}

export default async function DevolucionDetallePage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params
  const adminSupabase = await createAdminClient()

  const { data: devolucionData, error } = await adminSupabase
    .from('devoluciones')
    .select(`
      *,
      area:area_id(*),
      farmacia:farmacia_id(*),
      solicitud:solicitud_id(id, radicado),
      usuario_devuelve:devuelto_por(id, nombre, apellido, email, rol),
      usuario_confirma:confirmado_por(id, nombre, apellido, email, rol),
      items:devolucion_items(
        *,
        material:material_id(
          id, codigo, nombre,
          unidad_medida:unidad_medida_id(nombre, abreviatura)
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !devolucionData) {
    notFound()
  }

  const devolucion = devolucionData as unknown as Devolucion

  const { data: profile } = await adminSupabase
    .from('usuarios')
    .select('id, rol')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.rol === 'admin'
  const isFarmaciaRol = profile?.rol === 'farmacia'

  const { data: userFarmacia } = await adminSupabase
    .from('usuario_farmacias')
    .select('farmacia_id')
    .eq('usuario_id', user.id)
    .eq('farmacia_id', devolucion.farmacia_id)
    .maybeSingle()

  const userCanManageFarmacia = isAdmin || isFarmaciaRol || Boolean(userFarmacia)

  const estadoBadgeClass =
    DEVOLUCION_ESTADO_COLORS[devolucion.estado as DevolucionEstado] || 'bg-slate-800 text-slate-300'

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Navegación y Título */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/devoluciones" className="text-xs text-slate-400 hover:text-white transition-colors">
              ← Volver a Devoluciones
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-mono text-amber-400">{devolucion.radicado}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white font-mono">{devolucion.radicado}</h1>
            <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${estadoBadgeClass}`}>
              {DEVOLUCION_ESTADO_LABELS[devolucion.estado as DevolucionEstado] || devolucion.estado}
            </span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs text-slate-400">Valor Total Reintegrado</p>
          <p className="text-2xl font-bold text-emerald-400 font-mono">
            {fmtCOP(devolucion.valor_total)}
          </p>
        </div>
      </div>

      {/* Cliente con botones de Confirmar / Rechazar si está pendiente */}
      <DevolucionDetalleClient
        devolucion={devolucion}
        userCanManageFarmacia={userCanManageFarmacia}
      />

      {/* Tarjetas Informativas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs space-y-1">
          <p className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">Origen y Destino</p>
          <p className="text-white font-bold text-sm">
            Área: {devolucion.area?.nombre}
          </p>
          <p className="text-emerald-400">Hacia: {devolucion.farmacia?.nombre}</p>
          {devolucion.solicitud && (
            <p className="pt-1 text-sky-400">
              Solicitud Origen:{' '}
              <Link href={`/solicitudes/${devolucion.solicitud.id}`} className="underline font-mono">
                {devolucion.solicitud.radicado}
              </Link>
            </p>
          )}
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs space-y-1">
          <p className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">Motivo de Devolución</p>
          <p className="text-white font-bold text-sm">
            {DEVOLUCION_MOTIVO_LABELS[devolucion.motivo as DevolucionMotivo] || devolucion.motivo}
          </p>
          {devolucion.detalle && (
            <p className="text-slate-300 italic pt-1">{devolucion.detalle}</p>
          )}
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs space-y-1">
          <p className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">Auditoría y Trazabilidad</p>
          <p className="text-slate-300">
            Devuelto por:{' '}
            <span className="text-white font-medium">
              {devolucion.usuario_devuelve
                ? `${devolucion.usuario_devuelve.nombre} ${devolucion.usuario_devuelve.apellido}`
                : '-'}
            </span>
          </p>
          <p className="text-slate-400 font-mono">
            {format(new Date(devolucion.fecha_devolucion), 'dd/MM/yyyy HH:mm', { locale: es })}
          </p>
          {devolucion.fecha_confirmacion && (
            <div className="pt-1 border-t border-slate-800">
              <p className="text-emerald-400">
                Confirmado por:{' '}
                {devolucion.usuario_confirma
                  ? `${devolucion.usuario_confirma.nombre} ${devolucion.usuario_confirma.apellido}`
                  : 'Farmacia'}
              </p>
              <p className="text-slate-400 font-mono">
                {format(new Date(devolucion.fecha_confirmacion), 'dd/MM/yyyy HH:mm', { locale: es })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Observaciones de farmacia */}
      {devolucion.observaciones_farmacia && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-xs space-y-1">
          <p className="font-bold text-slate-300">Nota u Observaciones de Farmacia:</p>
          <p className="text-slate-400">{devolucion.observaciones_farmacia}</p>
        </div>
      )}

      {/* Tabla de Ítems */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden p-5 space-y-3">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span>📦</span>
          <span>Insumos Reintegrados</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Insumo</th>
                <th className="px-4 py-3">Unidad</th>
                <th className="px-4 py-3 text-right">Cant. Devuelta</th>
                <th className="px-4 py-3 text-right">Cant. Aceptada</th>
                <th className="px-4 py-3 text-right">Costo Unit.</th>
                <th className="px-4 py-3 text-right">Subtotal Reintegrado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {(devolucion.items || []).map((item) => {
                const subtotal = (item.cantidad_aceptada ?? item.cantidad) * item.costo_unitario
                return (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-sky-400">{item.material?.codigo}</td>
                    <td className="px-4 py-3 font-medium text-white">{item.material?.nombre}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {item.material?.unidad_medida?.abreviatura || item.material?.unidad_medida?.nombre || 'Und'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-400">
                      {item.cantidad}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400">
                      {item.cantidad_aceptada ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {fmtCOP(item.costo_unitario)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-white">
                      {fmtCOP(subtotal)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
