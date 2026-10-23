// src/app/(interno)/farmacia/kardex/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { MOV_FARMACIA_TIPO_LABELS, type MovFarmaciaTipo } from '@/types/farmacia'

export const metadata: Metadata = {
  title: 'Kardex de Farmacia — DentalLab Manager',
}

interface PageProps {
  searchParams: Promise<{
    farmacia_id?: string
    tipo?: string
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

const TIPO_COLORS: Record<MovFarmaciaTipo, string> = {
  entrada_compra: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  salida_despacho: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  entrada_devolucion: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  ajuste_positivo: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  ajuste_negativo: 'bg-red-500/10 text-red-400 border-red-500/30',
  traslado_entrada: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
  traslado_salida: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
}

export default async function KardexFarmaciaPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = await createAdminClient()
  const sp = await searchParams

  // Cargar farmacias para filtro
  const { data: farmacias } = await adminSupabase
    .from('farmacias')
    .select('id, codigo, nombre')
    .order('nombre')

  let query = adminSupabase
    .from('movimientos_farmacia')
    .select(`
      id, tipo, cantidad, stock_anterior, stock_resultante,
      costo_unitario, valor_total, documento_referencia, proveedor, motivo, created_at,
      farmacia:farmacia_id(codigo, nombre),
      material:material_id(codigo, nombre),
      area:area_id(codigo, nombre),
      usuario:usuario_id(nombre, apellido)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (sp.farmacia_id) {
    query = query.eq('farmacia_id', sp.farmacia_id)
  }
  if (sp.tipo) {
    query = query.eq('tipo', sp.tipo)
  }

  const { data: movimientos } = await query

  const filteredMovimientos = (movimientos || []).filter((m: any) => {
    if (!sp.q) return true
    const term = sp.q.toLowerCase()
    return (
      m.material?.nombre?.toLowerCase().includes(term) ||
      m.material?.codigo?.toLowerCase().includes(term) ||
      m.documento_referencia?.toLowerCase().includes(term) ||
      m.area?.nombre?.toLowerCase().includes(term) ||
      m.motivo?.toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Kardex de Movimientos — Farmacia</h1>
        <p className="text-slate-400 text-sm mt-1">
          Historial inmutable y auditable de cada entrada, salida, despacho, ajuste y devolución de insumos.
        </p>
      </div>

      {/* Barra de Filtros */}
      <form method="GET" className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Buscar por Insumo o Documento</label>
          <input
            name="q"
            defaultValue={sp.q || ''}
            placeholder="Ej: Guantes, SOL-2026-0001, FAC-12..."
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Farmacia</label>
          <select
            name="farmacia_id"
            defaultValue={sp.farmacia_id || ''}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="">Todas las farmacias</option>
            {farmacias?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.codigo} — {f.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Tipo de Movimiento</label>
          <select
            name="tipo"
            defaultValue={sp.tipo || ''}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="">Todos los tipos</option>
            {Object.entries(MOV_FARMACIA_TIPO_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
          >
            Filtrar
          </button>
          <a
            href="/farmacia/kardex"
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs rounded-xl transition-colors"
            title="Limpiar filtros"
          >
            Limpiar
          </a>
        </div>
      </form>

      {/* Tabla Kardex */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Fecha / Hora</th>
                <th className="px-4 py-3.5">Farmacia</th>
                <th className="px-4 py-3.5">Tipo</th>
                <th className="px-4 py-3.5">Insumo</th>
                <th className="px-4 py-3.5 text-right">Cantidad</th>
                <th className="px-4 py-3.5 text-right">Saldo Ant. → Post.</th>
                <th className="px-4 py-3.5 text-right">Costo Unit.</th>
                <th className="px-4 py-3.5 text-right">Total</th>
                <th className="px-4 py-3.5">Área / Doc / Motivo</th>
                <th className="px-4 py-3.5">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredMovimientos.map((m: any) => {
                const colorClass = TIPO_COLORS[m.tipo as MovFarmaciaTipo] || 'bg-slate-800 text-slate-300'
                const isPositive =
                  m.tipo === 'entrada_compra' ||
                  m.tipo === 'entrada_devolucion' ||
                  m.tipo === 'ajuste_positivo' ||
                  m.tipo === 'traslado_entrada'
                return (
                  <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-400 font-mono">
                      {format(new Date(m.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-300">
                      {m.farmacia?.codigo}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-lg border font-medium ${colorClass}`}>
                        {MOV_FARMACIA_TIPO_LABELS[m.tipo as MovFarmaciaTipo] || m.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{m.material?.nombre}</p>
                      <p className="text-[11px] text-sky-400 font-mono">{m.material?.codigo}</p>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-bold text-sm">
                      <span className={isPositive ? 'text-emerald-400' : 'text-indigo-400'}>
                        {isPositive ? '+' : '-'}
                        {m.cantidad}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-mono text-slate-400">
                      {m.stock_anterior} → <span className="text-white font-bold">{m.stock_resultante}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-mono text-slate-300">
                      {fmtCOP(m.costo_unitario)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-mono font-semibold text-white">
                      {fmtCOP(m.valor_total)}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {m.area && (
                        <p className="text-sky-300 font-medium">Área: {m.area.nombre}</p>
                      )}
                      {m.documento_referencia && (
                        <p className="text-slate-400 font-mono">Doc: {m.documento_referencia}</p>
                      )}
                      {m.proveedor && (
                        <p className="text-slate-400">Prov: {m.proveedor}</p>
                      )}
                      {m.motivo && (
                        <p className="text-slate-500 italic truncate" title={m.motivo}>
                          {m.motivo}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                      {m.usuario?.nombre} {m.usuario?.apellido}
                    </td>
                  </tr>
                )
              })}

              {filteredMovimientos.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500 text-sm">
                    No hay movimientos registrados que coincidan con la búsqueda.
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
