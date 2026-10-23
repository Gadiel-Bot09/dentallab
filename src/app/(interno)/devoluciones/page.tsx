// src/app/(interno)/devoluciones/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  DEVOLUCION_ESTADO_LABELS,
  DEVOLUCION_ESTADO_COLORS,
  DEVOLUCION_MOTIVO_LABELS,
  type DevolucionEstado,
  type DevolucionMotivo,
} from '@/types/farmacia'

export const metadata: Metadata = {
  title: 'Devoluciones de Insumos — DentalLab Manager',
}

interface PageProps {
  searchParams: Promise<{
    estado?: string
    area_id?: string
    farmacia_id?: string
    motivo?: string
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

export default async function DevolucionesPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = await createAdminClient()
  const sp = await searchParams

  const [{ data: areas }, { data: farmacias }] = await Promise.all([
    adminSupabase.from('areas').select('id, codigo, nombre').order('nombre'),
    adminSupabase.from('farmacias').select('id, codigo, nombre').order('nombre'),
  ])

  let query = adminSupabase
    .from('devoluciones')
    .select(`
      id, radicado, estado, motivo, detalle, valor_total, fecha_devolucion,
      solicitud:solicitud_id(id, radicado),
      area:area_id(codigo, nombre),
      farmacia:farmacia_id(codigo, nombre),
      devuelto_por_usuario:devuelto_por(nombre, apellido)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (sp.estado) query = query.eq('estado', sp.estado)
  if (sp.area_id) query = query.eq('area_id', sp.area_id)
  if (sp.farmacia_id) query = query.eq('farmacia_id', sp.farmacia_id)
  if (sp.motivo) query = query.eq('motivo', sp.motivo)

  const { data: devoluciones } = await query

  const filtered = (devoluciones || []).filter((d: any) => {
    if (!sp.q) return true
    const term = sp.q.toLowerCase()
    return (
      d.radicado?.toLowerCase().includes(term) ||
      d.solicitud?.radicado?.toLowerCase().includes(term) ||
      d.area?.nombre?.toLowerCase().includes(term) ||
      d.farmacia?.nombre?.toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Devoluciones de Insumos</h1>
        <p className="text-slate-400 text-sm mt-1">
          Reintegros de insumos no utilizados, vencidos o defectuosos desde las áreas hacia farmacia.
        </p>
      </div>

      {/* Filtros */}
      <form method="GET" className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800 text-xs">
        <div>
          <label className="block text-slate-400 font-medium mb-1">Buscar Radicado</label>
          <input
            name="q"
            defaultValue={sp.q || ''}
            placeholder="DEV-2026-..."
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </div>

        <div>
          <label className="block text-slate-400 font-medium mb-1">Estado</label>
          <select
            name="estado"
            defaultValue={sp.estado || ''}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          >
            <option value="">Todos los estados</option>
            {Object.entries(DEVOLUCION_ESTADO_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-400 font-medium mb-1">Área</label>
          <select
            name="area_id"
            defaultValue={sp.area_id || ''}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
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
          <label className="block text-slate-400 font-medium mb-1">Motivo</label>
          <select
            name="motivo"
            defaultValue={sp.motivo || ''}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          >
            <option value="">Todos los motivos</option>
            {Object.entries(DEVOLUCION_MOTIVO_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-1.5">
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl shadow-lg shadow-amber-600/20 transition-all"
          >
            Filtrar
          </button>
          <a
            href="/devoluciones"
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            ✕
          </a>
        </div>
      </form>

      {/* Tabla de Devoluciones */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Radicado Devolución</th>
                <th className="px-4 py-3.5">Solicitud Origen</th>
                <th className="px-4 py-3.5">Área</th>
                <th className="px-4 py-3.5">Farmacia</th>
                <th className="px-4 py-3.5">Motivo</th>
                <th className="px-4 py-3.5">Estado</th>
                <th className="px-4 py-3.5">Fecha</th>
                <th className="px-4 py-3.5 text-right">Valor Total Reintegrado</th>
                <th className="px-4 py-3.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filtered.map((d: any) => {
                const colorClass =
                  DEVOLUCION_ESTADO_COLORS[d.estado as DevolucionEstado] || 'bg-slate-800 text-slate-300'
                return (
                  <tr key={d.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-amber-400">
                      <Link href={`/devoluciones/${d.id}`} className="hover:underline">
                        {d.radicado}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-sky-400">
                      {d.solicitud ? (
                        <Link href={`/solicitudes/${d.solicitud.id}`} className="hover:underline">
                          {d.solicitud.radicado}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">{d.area?.nombre}</td>
                    <td className="px-4 py-3 text-slate-400">{d.farmacia?.nombre}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {DEVOLUCION_MOTIVO_LABELS[d.motivo as DevolucionMotivo] || d.motivo}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-lg border font-medium ${colorClass}`}>
                        {DEVOLUCION_ESTADO_LABELS[d.estado as DevolucionEstado] || d.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {format(new Date(d.fecha_devolucion), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                      {fmtCOP(d.valor_total)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/devoluciones/${d.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 rounded-lg font-medium transition-colors"
                      >
                        <span>Ver</span>
                        <span>→</span>
                      </Link>
                    </td>
                  </tr>
                )
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500 text-sm">
                    No hay devoluciones registradas con los filtros actuales.
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
