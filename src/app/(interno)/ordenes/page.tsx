// src/app/(interno)/ordenes/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import OrdenesTable from './_components/OrdenesTable'
import { ORDEN_ESTADO_LABELS, type OrdenEstado } from '@/types/database'

export const metadata: Metadata = {
  title: 'Órdenes de Servicio — DentalLab Manager',
}

export default async function OrdenesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string; radicado?: string; lab?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const estadoFiltro = params.estado as OrdenEstado | undefined
  const textSearch = params.q ?? ''
  const radicadoSearch = params.radicado ?? ''

  let query = supabase
    .from('ordenes_servicio')
    .select(`
      id, radicado, tipo_trabajo, estado, fecha_estimada_entrega,
      fecha_creacion, costo_total_materiales, precio_venta, margen_ganancia,
      pacientes(nombre, apellido),
      laboratorios(nombre),
      usuarios!odontologo_id(nombre, apellido)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (estadoFiltro) query = query.eq('estado', estadoFiltro)
  if (radicadoSearch) query = query.ilike('radicado', `%${radicadoSearch}%`)
  if (textSearch) query = query.ilike('tipo_trabajo', `%${textSearch}%`)

  const { data: ordenes, error } = await query
  if (error) console.error('[ORDENES]', error)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Órdenes de Servicio</h1>
          <p className="text-slate-400 text-sm">{ordenes?.length ?? 0} resultado(s) encontrado(s)</p>
        </div>
        <Link
          id="btn-nueva-orden"
          href="/ordenes/nueva"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-sky-500/20 transition-all duration-200"
        >
          <span>+</span> Nueva Orden
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <span className="text-slate-400 text-sm font-medium">Filtrar:</span>
        <a
          href="/ordenes"
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!estadoFiltro ? 'bg-sky-500/20 text-sky-400 border border-sky-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
        >
          Todos
        </a>
        {(Object.keys(ORDEN_ESTADO_LABELS) as OrdenEstado[]).map((estado) => (
          <a
            key={estado}
            href={`/ordenes?estado=${estado}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${estadoFiltro === estado ? 'bg-sky-500/20 text-sky-400 border border-sky-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            {ORDEN_ESTADO_LABELS[estado]}
          </a>
        ))}
      </div>

      {/* Table */}
      <OrdenesTable ordenes={(ordenes as any[]) ?? []} />
    </div>
  )
}
