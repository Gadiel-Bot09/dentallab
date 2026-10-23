// src/app/(interno)/solicitudes/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  SOLICITUD_ESTADO_LABELS,
  SOLICITUD_ESTADO_COLORS,
  SOLICITUD_TIPO_LABELS,
  type SolicitudEstado,
} from '@/types/farmacia'

export const metadata: Metadata = {
  title: 'Solicitudes de Insumos — DentalLab Manager',
}

interface PageProps {
  searchParams: Promise<{
    estado?: string
    area_id?: string
    farmacia_id?: string
    tipo?: string
    prioridad?: string
    q?: string
  }>
}

function fmtCOP(v: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(v || 0)
}

export default async function SolicitudesPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = await createAdminClient()
  const sp = await searchParams

  // Cargar áreas y farmacias para filtros
  const [{ data: areas }, { data: farmacias }] = await Promise.all([
    adminSupabase.from('areas').select('id, codigo, nombre').order('nombre'),
    adminSupabase.from('farmacias').select('id, codigo, nombre').order('nombre'),
  ])

  // Consulta de solicitudes con joins
  let query = adminSupabase
    .from('solicitudes')
    .select(`
      id, radicado, tipo, prioridad, periodo_inicio, periodo_fin,
      estado, con_novedad, valor_despachado, valor_devuelto,
      fecha_solicitud, fecha_despacho, fecha_recepcion, created_at,
      area:area_id(codigo, nombre),
      farmacia:farmacia_id(codigo, nombre),
      solicitante:solicitado_por(nombre, apellido),
      despachador:despachado_por(nombre, apellido)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (sp.estado) {
    query = query.eq('estado', sp.estado)
  }
  if (sp.area_id) {
    query = query.eq('area_id', sp.area_id)
  }
  if (sp.farmacia_id) {
    query = query.eq('farmacia_id', sp.farmacia_id)
  }
  if (sp.tipo) {
    query = query.eq('tipo', sp.tipo)
  }
  if (sp.prioridad) {
    query = query.eq('prioridad', sp.prioridad)
  }

  const { data: solicitudes } = await query

  const filtered = (solicitudes || []).filter((s: any) => {
    if (!sp.q) return true
    const term = sp.q.toLowerCase()
    return (
      s.radicado?.toLowerCase().includes(term) ||
      s.area?.nombre?.toLowerCase().includes(term) ||
      s.farmacia?.nombre?.toLowerCase().includes(term)
    )
  })

  // Conteo rápido por estados
  const { data: countsData } = await adminSupabase
    .from('solicitudes')
    .select('estado')

  const counts: Record<string, number> = {}
  ;(countsData || []).forEach((c) => {
    counts[c.estado] = (counts[c.estado] || 0) + 1
  })

  const pendientesDespacho = (counts['enviada'] || 0) + (counts['aprobada'] || 0) + (counts['despachada_parcial'] || 0)
  const recibidas = counts['recibida'] || 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Solicitudes de Insumos</h1>
          <p className="text-slate-400 text-sm mt-1">
            Pedidos de materiales de las áreas a farmacia, control de despachos y recepciones.
          </p>
        </div>
        <Link
          href="/solicitudes/nueva"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-sky-500/20 transition-all"
        >
          <span>➕</span>
          <span>Nueva Solicitud</span>
        </Link>
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/solicitudes?estado=enviada"
          className="p-3.5 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 rounded-xl transition-all"
        >
          <p className="text-xs text-amber-400 font-medium">Pendientes de Farmacia</p>
          <p className="text-2xl font-bold text-white mt-1">{counts['enviada'] || 0}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Por revisar/aprobar</p>
        </Link>
        <Link
          href="/solicitudes?estado=aprobada"
          className="p-3.5 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 rounded-xl transition-all"
        >
          <p className="text-xs text-sky-400 font-medium">Listas para Despacho</p>
          <p className="text-2xl font-bold text-white mt-1">{counts['aprobada'] || 0}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Aprobadas</p>
        </Link>
        <Link
          href="/solicitudes?estado=despachada"
          className="p-3.5 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 rounded-xl transition-all"
        >
          <p className="text-xs text-indigo-400 font-medium">En Tránsito a Área</p>
          <p className="text-2xl font-bold text-white mt-1">
            {(counts['despachada'] || 0) + (counts['despachada_parcial'] || 0)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Esperando recepción</p>
        </Link>
        <Link
          href="/solicitudes?estado=recibida"
          className="p-3.5 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 rounded-xl transition-all"
        >
          <p className="text-xs text-emerald-400 font-medium">Recibidas en Área</p>
          <p className="text-2xl font-bold text-white mt-1">{recibidas}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Con o sin novedad</p>
        </Link>
      </div>

      {/* Filtros */}
      <form method="GET" className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 text-xs">
        <div>
          <label className="block text-slate-400 font-medium mb-1">Buscar Radicado</label>
          <input
            name="q"
            defaultValue={sp.q || ''}
            placeholder="SOL-2026-..."
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
        </div>

        <div>
          <label className="block text-slate-400 font-medium mb-1">Estado</label>
          <select
            name="estado"
            defaultValue={sp.estado || ''}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          >
            <option value="">Todos los estados</option>
            {Object.entries(SOLICITUD_ESTADO_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-400 font-medium mb-1">Área Solicitante</label>
          <select
            name="area_id"
            defaultValue={sp.area_id || ''}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          >
            <option value="">Todas las áreas</option>
            {areas?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.codigo} — {a.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-400 font-medium mb-1">Farmacia Destino</label>
          <select
            name="farmacia_id"
            defaultValue={sp.farmacia_id || ''}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          >
            <option value="">Todas las farmacias</option>
            {farmacias?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.codigo} — {f.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-1.5">
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white font-medium rounded-xl shadow-lg shadow-sky-500/20 transition-all"
          >
            Filtrar
          </button>
          <a
            href="/solicitudes"
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            ✕
          </a>
        </div>
      </form>

      {/* Tabla de Solicitudes */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Radicado</th>
                <th className="px-4 py-3.5">Tipo / Prioridad</th>
                <th className="px-4 py-3.5">Área Solicitante</th>
                <th className="px-4 py-3.5">Farmacia Destino</th>
                <th className="px-4 py-3.5">Estado</th>
                <th className="px-4 py-3.5">Fecha Solicitud</th>
                <th className="px-4 py-3.5 text-right">Valor Despachado</th>
                <th className="px-4 py-3.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filtered.map((s: any) => {
                const colorClass =
                  SOLICITUD_ESTADO_COLORS[s.estado as SolicitudEstado] ||
                  'bg-slate-800 text-slate-300'
                const isUrgente = s.prioridad === 'urgente'

                return (
                  <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/solicitudes/${s.id}`}
                        className="font-mono font-bold text-sky-400 hover:text-sky-300 text-sm flex items-center gap-1.5"
                      >
                        {s.radicado}
                        {s.con_novedad && (
                          <span className="text-amber-400 text-xs" title="Recibida con novedad">
                            ⚠️
                          </span>
                        )}
                      </Link>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-300">
                          {SOLICITUD_TIPO_LABELS[s.tipo as 'puntual' | 'semanal' | 'mensual'] || s.tipo}
                        </span>
                        {isUrgente && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 font-bold animate-pulse">
                            URGENTE
                          </span>
                        )}
                      </div>
                      {s.periodo_inicio && s.periodo_fin && (
                        <p className="text-[11px] text-slate-500">
                          {s.periodo_inicio} al {s.periodo_fin}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium text-white">{s.area?.nombre}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{s.area?.codigo}</p>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-slate-300">{s.farmacia?.nombre}</p>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-lg border font-medium ${colorClass}`}>
                        {SOLICITUD_ESTADO_LABELS[s.estado as SolicitudEstado] || s.estado}
                      </span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                      {s.fecha_solicitud
                        ? format(new Date(s.fecha_solicitud), 'dd/MM/yyyy HH:mm', { locale: es })
                        : format(new Date(s.created_at), 'dd/MM/yyyy (Borrador)', { locale: es })}
                      {s.solicitante && (
                        <p className="text-[11px] text-slate-500">
                          Por: {s.solicitante.nombre}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-right font-mono font-semibold text-slate-200">
                      {fmtCOP(s.valor_despachado)}
                      {Number(s.valor_devuelto) > 0 && (
                        <span className="block text-[11px] text-emerald-400">
                          - {fmtCOP(s.valor_devuelto)} devuelto
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <Link
                        href={`/solicitudes/${s.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 font-medium rounded-lg text-xs transition-colors"
                      >
                        <span>Ver Detalle</span>
                        <span>→</span>
                      </Link>
                    </td>
                  </tr>
                )
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500 text-sm">
                    No se encontraron solicitudes con los criterios de búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
