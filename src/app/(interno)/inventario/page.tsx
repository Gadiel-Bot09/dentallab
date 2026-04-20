// src/app/(interno)/inventario/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import InventarioTable from './_components/InventarioTable'

export const metadata: Metadata = {
  title: 'Inventario — DentalLab Manager',
}

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; alerta?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()

  const params = await searchParams
  const q = params.q ?? ''
  const categoria = params.categoria ?? ''
  const soloAlertas = params.alerta === '1'

  let query = supabase
    .from('inventario')
    .select('*')
    .eq('activo', true)
    .order('nombre')

  if (q) query = query.ilike('nombre', `%${q}%`)
  if (categoria) query = query.eq('categoria', categoria)

  let { data: inventario } = await query

  if (soloAlertas) {
    inventario = (inventario ?? []).filter((m) => m.stock_actual <= m.stock_minimo)
  }

  const valorTotal = (inventario ?? []).reduce(
    (acc, m) => acc + m.stock_actual * m.precio_unitario, 0
  )

  const categorias = ['resinas', 'metales', 'acrílicos', 'adhesivos', 'ceras', 'yesos', 'instrumentos', 'otros']

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Inventario</h1>
          <p className="text-slate-400 text-sm">
            {inventario?.length ?? 0} material(es) ·{' '}
            <span className="text-emerald-400 font-medium">
              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valorTotal)} valor total
            </span>
          </p>
        </div>
        {profile?.rol === 'admin' && (
          <Link
            id="btn-nuevo-material"
            href="/inventario/nuevo"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-sky-500/20 transition-all duration-200"
          >
            + Nuevo Material
          </Link>
        )}
      </div>

      {/* Filters */}
      <form method="GET" className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar material..."
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
        />
        <select
          name="categoria"
          defaultValue={categoria}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
          <input type="checkbox" name="alerta" value="1" defaultChecked={soloAlertas} className="rounded" />
          Solo alertas de stock bajo
        </label>
        <button
          type="submit"
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm transition-colors"
        >
          Filtrar
        </button>
      </form>

      <InventarioTable materials={inventario ?? []} userRol={profile?.rol ?? 'auxiliar'} />
    </div>
  )
}
