// src/app/(interno)/solicitudes/[id]/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  SOLICITUD_ESTADO_LABELS,
  SOLICITUD_ESTADO_COLORS,
  SOLICITUD_TIPO_LABELS,
  DEVOLUCION_ESTADO_LABELS,
  DEVOLUCION_ESTADO_COLORS,
  type Solicitud,
  type SolicitudEstado,
} from '@/types/farmacia'
import SolicitudDetalleClient from './_components/SolicitudDetalleClient'

export const metadata: Metadata = {
  title: 'Detalle de Solicitud — DentalLab Manager',
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

export default async function SolicitudDetallePage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params
  const adminSupabase = await createAdminClient()

  const { data: solicitudData, error } = await adminSupabase
    .from('solicitudes')
    .select(`
      *,
      area:area_id(*),
      farmacia:farmacia_id(*),
      solicitante:solicitado_por(id, nombre, apellido, email, rol),
      aprobador:aprobado_por(id, nombre, apellido, email, rol),
      despachador:despachado_por(id, nombre, apellido, email, rol),
      recibidor:recibido_por(id, nombre, apellido, email, rol),
      items:solicitud_items(
        *,
        material:material_id(
          id, codigo, nombre, precio_unitario,
          categoria:categoria_id(nombre),
          unidad_medida:unidad_medida_id(nombre, abreviatura)
        )
      ),
      eventos:solicitud_eventos(
        *,
        usuario:usuario_id(nombre, apellido, rol)
      )
    `)
    .eq('id', id)
    .single()

  if (error || !solicitudData) {
    notFound()
  }

  const solicitud = solicitudData as unknown as Solicitud

  // Cargar devoluciones vinculadas a esta solicitud
  const { data: devolucionesData } = await adminSupabase
    .from('devoluciones')
    .select('id, radicado, estado, motivo, valor_total, fecha_devolucion')
    .eq('solicitud_id', id)
    .order('created_at', { ascending: false })

  // Obtener perfil del usuario para validar permisos
  const { data: profile } = await adminSupabase
    .from('usuarios')
    .select('id, rol')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.rol === 'admin'

  // Validar si pertenece a la farmacia
  const { data: userFarmacia } = await adminSupabase
    .from('usuario_farmacias')
    .select('farmacia_id')
    .eq('usuario_id', user.id)
    .eq('farmacia_id', solicitud.farmacia_id)
    .maybeSingle()

  // Validar si pertenece al área
  const { data: userArea } = await adminSupabase
    .from('usuario_areas')
    .select('area_id')
    .eq('usuario_id', user.id)
    .eq('area_id', solicitud.area_id)
    .maybeSingle()

  const userCanApproveOrDispatch = isAdmin || Boolean(userFarmacia) || profile?.rol === 'farmacia'
  const userCanReceiveOrReturn = isAdmin || Boolean(userArea) || profile?.rol === 'jefe_area'

  // Cargar stock disponible en esta farmacia para los materiales de la solicitud
  const materialIds = (solicitud.items || []).map((i) => i.material_id)
  const { data: stockItems } = await adminSupabase
    .from('stock_farmacia')
    .select('material_id, cantidad')
    .eq('farmacia_id', solicitud.farmacia_id)
    .in('material_id', materialIds)

  const stockFarmaciaMap: Record<string, number> = {}
  ;(stockItems || []).forEach((s) => {
    stockFarmaciaMap[s.material_id] = Number(s.cantidad || 0)
  })

  const estadoBadgeClass =
    SOLICITUD_ESTADO_COLORS[solicitud.estado as SolicitudEstado] || 'bg-slate-800 text-slate-300'

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Navegación y Título */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/solicitudes"
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              ← Volver a Solicitudes
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-mono text-sky-400">{solicitud.radicado}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-white font-mono">{solicitud.radicado}</h1>
            <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${estadoBadgeClass}`}>
              {SOLICITUD_ESTADO_LABELS[solicitud.estado as SolicitudEstado] || solicitud.estado}
            </span>
            {solicitud.prioridad === 'urgente' && (
              <span className="px-2.5 py-1 rounded-xl text-xs bg-red-500/20 text-red-400 border border-red-500/30 font-bold animate-pulse">
                URGENTE 🚨
              </span>
            )}
            {solicitud.con_novedad && (
              <span className="px-2.5 py-1 rounded-xl text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                ⚠️ Con Novedad en Recepción
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs text-slate-400">Total Despachado Valorizado</p>
          <p className="text-2xl font-bold text-emerald-400 font-mono">
            {fmtCOP(solicitud.valor_despachado)}
          </p>
          {Number(solicitud.valor_devuelto) > 0 && (
            <p className="text-xs text-amber-400">
              - {fmtCOP(solicitud.valor_devuelto)} devuelto
            </p>
          )}
        </div>
      </div>

      {/* Cliente Interactivo de Acciones (Botones Despachar, Aprobar, Recibir, etc.) */}
      <SolicitudDetalleClient
        solicitud={solicitud}
        currentUserId={user.id}
        currentUserRole={profile?.rol || ''}
        userCanApproveOrDispatch={userCanApproveOrDispatch}
        userCanReceiveOrReturn={userCanReceiveOrReturn}
        stockFarmaciaMap={stockFarmaciaMap}
      />

      {/* Metadatos y Auditoría de Etapas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Solicitud */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs space-y-1">
          <p className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">1. Solicitud</p>
          <p className="text-sm font-bold text-white">
            {solicitud.solicitante
              ? `${solicitud.solicitante.nombre} ${solicitud.solicitante.apellido}`
              : 'En borrador'}
          </p>
          <p className="text-slate-400">
            {solicitud.fecha_solicitud
              ? format(new Date(solicitud.fecha_solicitud), 'dd/MM/yyyy HH:mm', { locale: es })
              : 'Pendiente de envío'}
          </p>
          <p className="text-sky-400 font-medium pt-1">
            Área: {solicitud.area?.nombre} ({solicitud.area?.codigo})
          </p>
        </div>

        {/* Aprobación */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs space-y-1">
          <p className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">2. Aprobación</p>
          <p className="text-sm font-bold text-white">
            {solicitud.aprobador
              ? `${solicitud.aprobador.nombre} ${solicitud.aprobador.apellido}`
              : solicitud.estado === 'rechazada'
              ? 'Rechazado'
              : 'Pendiente'}
          </p>
          <p className="text-slate-400">
            {solicitud.fecha_aprobacion
              ? format(new Date(solicitud.fecha_aprobacion), 'dd/MM/yyyy HH:mm', { locale: es })
              : '-'}
          </p>
          <p className="text-emerald-400 font-medium pt-1">
            Farmacia: {solicitud.farmacia?.nombre}
          </p>
        </div>

        {/* Despacho */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs space-y-1">
          <p className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">3. Despacho</p>
          <p className="text-sm font-bold text-white">
            {solicitud.despachador
              ? `${solicitud.despachador.nombre} ${solicitud.despachador.apellido}`
              : 'Pendiente'}
          </p>
          <p className="text-slate-400">
            {solicitud.fecha_despacho
              ? format(new Date(solicitud.fecha_despacho), 'dd/MM/yyyy HH:mm', { locale: es })
              : '-'}
          </p>
          <p className="text-slate-500 pt-1">
            Tipo: {SOLICITUD_TIPO_LABELS[solicitud.tipo]}
          </p>
        </div>

        {/* Recepción */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs space-y-1">
          <p className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">4. Recepción en Área</p>
          <p className="text-sm font-bold text-white">
            {solicitud.recibidor
              ? `${solicitud.recibidor.nombre} ${solicitud.recibidor.apellido}`
              : 'Pendiente'}
          </p>
          <p className="text-slate-400">
            {solicitud.fecha_recepcion
              ? format(new Date(solicitud.fecha_recepcion), 'dd/MM/yyyy HH:mm', { locale: es })
              : '-'}
          </p>
          <p className="text-slate-500 pt-1">
            {solicitud.fecha_cierre ? 'Cerrada formalmente' : 'Abierta'}
          </p>
        </div>
      </div>

      {/* Alertas / Mensajes de Rechazo o Anulación */}
      {solicitud.motivo_rechazo && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-400 space-y-1">
          <p className="font-bold">❌ Solicitud Rechazada por Farmacia:</p>
          <p>{solicitud.motivo_rechazo}</p>
        </div>
      )}

      {solicitud.motivo_anulacion && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-400 space-y-1">
          <p className="font-bold">🚫 Solicitud Anulada:</p>
          <p>{solicitud.motivo_anulacion}</p>
        </div>
      )}

      {solicitud.observaciones_recepcion && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-400 space-y-1">
          <p className="font-bold">📝 Novedad / Observación de Recepción en Área:</p>
          <p>{solicitud.observaciones_recepcion}</p>
        </div>
      )}

      {/* Tabla Comparativa de Insumos */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden space-y-3 p-5">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span>📦</span>
          <span>Insumos y Cantidades en el Flujo</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Insumo</th>
                <th className="px-4 py-3">Unidad</th>
                <th className="px-4 py-3 text-right">Solicitada</th>
                <th className="px-4 py-3 text-right">Aprobada</th>
                <th className="px-4 py-3 text-right">Despachada</th>
                <th className="px-4 py-3 text-right">Recibida</th>
                <th className="px-4 py-3 text-right">Devuelta</th>
                <th className="px-4 py-3 text-right">Costo Unit.</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {(solicitud.items || []).map((item) => {
                const subtotal = item.cantidad_despachada * item.costo_unitario
                return (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-sky-400">{item.material?.codigo}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{item.material?.nombre}</p>
                      {item.observaciones && (
                        <p className="text-[11px] text-slate-400 italic">{item.observaciones}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {item.material?.unidad_medida?.abreviatura || item.material?.unidad_medida?.nombre || 'Und'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-200">
                      {item.cantidad_solicitada}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-sky-400">
                      {item.cantidad_aprobada ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400">
                      {item.cantidad_despachada}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-300">
                      {item.cantidad_recibida}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-amber-400">
                      {item.cantidad_devuelta > 0 ? item.cantidad_devuelta : '-'}
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

      {/* Devoluciones Vinculadas (si existen) */}
      {devolucionesData && devolucionesData.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>↩️</span>
            <span>Devoluciones Asociadas a esta Solicitud</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {devolucionesData.map((d: any) => (
              <Link
                key={d.id}
                href={`/devoluciones/${d.id}`}
                className="p-4 bg-slate-950 rounded-xl border border-slate-800 hover:border-amber-500/40 transition-all flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-mono font-bold text-amber-400">{d.radicado}</p>
                  <p className="text-slate-400 mt-0.5">Motivo: {d.motivo}</p>
                  <p className="text-slate-500 text-[11px] mt-1">
                    {format(new Date(d.fecha_devolucion), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-medium ${DEVOLUCION_ESTADO_COLORS[d.estado as 'pendiente' | 'confirmada' | 'rechazada']}`}>
                    {DEVOLUCION_ESTADO_LABELS[d.estado as 'pendiente' | 'confirmada' | 'rechazada'] || d.estado}
                  </span>
                  <p className="text-slate-300 font-mono font-bold mt-2">{fmtCOP(d.valor_total)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Línea de Tiempo de Eventos y Auditoría */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span>📜</span>
          <span>Línea de Tiempo y Trazabilidad de Auditoría</span>
        </h3>

        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
          {(solicitud.eventos || []).map((ev: any, idx) => (
            <div key={ev.id || idx} className="relative text-xs">
              <span className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-sky-500 border-2 border-slate-950" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-white uppercase">{ev.accion.replace('_', ' ')}</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400 font-mono">
                  {format(new Date(ev.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-sky-400 font-medium">
                  {ev.usuario ? `${ev.usuario.nombre} ${ev.usuario.apellido} (${ev.usuario.rol})` : 'Sistema'}
                </span>
              </div>
              {ev.comentario && (
                <p className="text-slate-300 mt-1 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                  {ev.comentario}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
