// src/app/(interno)/farmacia/reportes/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { startOfMonth, format } from 'date-fns'
import type { Area, Farmacia } from '@/types/database'
import FarmaciaReportesClient, {
  type ConsumoAreaRow,
  type ConsumoInsumoRow,
} from './_components/FarmaciaReportesClient'

export const metadata: Metadata = {
  title: 'Indicadores y Reportes de Farmacia — DentalLab Manager',
}

interface PageProps {
  searchParams: Promise<{
    desde?: string
    hasta?: string
    farmacia_id?: string
    area_id?: string
  }>
}

export default async function FarmaciaReportesPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('id, nombre, apellido, rol')
    .eq('id', user.id)
    .single()

  const adminSupabase = await createAdminClient()
  const sp = await searchParams

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const startMonthStr = format(startOfMonth(new Date()), 'yyyy-MM-dd')

  const desde = sp.desde || startMonthStr
  const hasta = sp.hasta || todayStr
  const farmaciaId = sp.farmacia_id || ''
  const areaId = sp.area_id || ''

  // Cargar catálogos para filtros
  const [{ data: areasData }, { data: farmaciasData }] = await Promise.all([
    adminSupabase.from('areas').select('*').order('nombre'),
    adminSupabase.from('farmacias').select('*').order('nombre'),
  ])

  // Consultar movimientos dentro del rango de fecha
  let query = adminSupabase
    .from('movimientos_farmacia')
    .select(`
      id, tipo, cantidad, valor_total, created_at,
      farmacia_id, area_id, material_id,
      farmacia:farmacia_id(codigo, nombre),
      area:area_id(codigo, nombre, centro_costo),
      material:material_id(
        codigo, nombre,
        categoria:categoria_id(nombre),
        unidad_medida:unidad_medida_id(nombre, abreviatura)
      )
    `)
    .in('tipo', ['salida_despacho', 'entrada_devolucion'])
    .gte('created_at', `${desde}T00:00:00.000Z`)
    .lte('created_at', `${hasta}T23:59:59.999Z`)

  if (farmaciaId) query = query.eq('farmacia_id', farmaciaId)
  if (areaId) query = query.eq('area_id', areaId)

  const { data: movimientos } = await query

  // Agrupar por Área
  const areaMap = new Map<string, ConsumoAreaRow>()
  // Agrupar por Insumo
  const insumoMap = new Map<string, ConsumoInsumoRow>()

  let totalValorDespachado = 0
  let totalValorDevuelto = 0
  let totalCantDespachada = 0
  let totalCantDevuelta = 0

  ;(movimientos || []).forEach((m: any) => {
    const isDespacho = m.tipo === 'salida_despacho'
    const isDevolucion = m.tipo === 'entrada_devolucion'

    const cant = Number(m.cantidad || 0)
    const val = Number(m.valor_total || 0)

    if (isDespacho) {
      totalValorDespachado += val
      totalCantDespachada += cant
    } else if (isDevolucion) {
      totalValorDevuelto += val
      totalCantDevuelta += cant
    }

    // Por Área
    if (m.area_id) {
      const existingArea = areaMap.get(m.area_id) || {
        area_id: m.area_id,
        area_codigo: m.area?.codigo || 'S/C',
        area_nombre: m.area?.nombre || 'Área Desconocida',
        centro_costo: m.area?.centro_costo || '',
        cant_despachada: 0,
        cant_devuelta: 0,
        valor_despachado: 0,
        valor_devuelto: 0,
        gasto_neto: 0,
      }

      if (isDespacho) {
        existingArea.cant_despachada += cant
        existingArea.valor_despachado += val
        existingArea.gasto_neto += val
      } else if (isDevolucion) {
        existingArea.cant_devuelta += cant
        existingArea.valor_devuelto += val
        existingArea.gasto_neto -= val
      }

      areaMap.set(m.area_id, existingArea)
    }

    // Por Insumo
    if (m.material_id) {
      const existingInsumo = insumoMap.get(m.material_id) || {
        material_id: m.material_id,
        material_codigo: m.material?.codigo || '',
        material_nombre: m.material?.nombre || 'Insumo',
        categoria: m.material?.categoria?.nombre || 'General',
        unidad: m.material?.unidad_medida?.abreviatura || m.material?.unidad_medida?.nombre || 'Und',
        cantidad_neta: 0,
        valor_neto: 0,
      }

      if (isDespacho) {
        existingInsumo.cantidad_neta += cant
        existingInsumo.valor_neto += val
      } else if (isDevolucion) {
        existingInsumo.cantidad_neta -= cant
        existingInsumo.valor_neto -= val
      }

      insumoMap.set(m.material_id, existingInsumo)
    }
  })

  const consumoPorArea = Array.from(areaMap.values()).sort(
    (a, b) => b.gasto_neto - a.gasto_neto
  )

  const topInsumos = Array.from(insumoMap.values())
    .filter((i) => i.cantidad_neta > 0)
    .sort((a, b) => b.valor_neto - a.valor_neto)
    .slice(0, 15)

  // Conteo de solicitudes en el período
  const { count: totalSolicitudes } = await adminSupabase
    .from('solicitudes')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${desde}T00:00:00.000Z`)
    .lte('created_at', `${hasta}T23:59:59.999Z`)

  const userName = profile ? `${profile.nombre} ${profile.apellido}` : 'Usuario'

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Indicadores y Reportes de Farmacia</h1>
        <p className="text-slate-400 text-sm mt-1">
          Métricas de consumo por área, costos totales valorizados, indicadores de devolución y exportación a Excel / PDF.
        </p>
      </div>

      {/* Formulario de Filtros */}
      <form method="GET" className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800 text-xs">
        <div>
          <label className="block text-slate-400 font-medium mb-1">Fecha Desde</label>
          <input
            name="desde"
            type="date"
            defaultValue={desde}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
          />
        </div>

        <div>
          <label className="block text-slate-400 font-medium mb-1">Fecha Hasta</label>
          <input
            name="hasta"
            type="date"
            defaultValue={hasta}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
          />
        </div>

        <div>
          <label className="block text-slate-400 font-medium mb-1">Farmacia</label>
          <select
            name="farmacia_id"
            defaultValue={farmaciaId}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
          >
            <option value="">Todas las farmacias</option>
            {farmaciasData?.map((f: any) => (
              <option key={f.id} value={f.id}>
                {f.codigo} — {f.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-400 font-medium mb-1">Área Específica</label>
          <select
            name="area_id"
            defaultValue={areaId}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
          >
            <option value="">Todas las áreas</option>
            {areasData?.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.codigo} — {a.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-1.5">
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white font-medium rounded-xl shadow-lg shadow-sky-500/20 transition-all"
          >
            Actualizar
          </button>
          <a
            href="/farmacia/reportes"
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            ✕
          </a>
        </div>
      </form>

      {/* Componente Cliente con KPIs, Tablas y Exportación a Excel/PDF */}
      <FarmaciaReportesClient
        areas={(areasData as Area[]) || []}
        farmacias={(farmaciasData as Farmacia[]) || []}
        consumoPorArea={consumoPorArea}
        topInsumos={topInsumos}
        totales={{
          gastoNeto: totalValorDespachado - totalValorDevuelto,
          valorDespachado: totalValorDespachado,
          valorDevuelto: totalValorDevuelto,
          cantDespachada: totalCantDespachada,
          cantDevuelta: totalCantDevuelta,
          totalSolicitudes: totalSolicitudes || 0,
        }}
        filtros={{
          desde,
          hasta,
          farmaciaId,
          areaId,
        }}
        userName={userName}
      />
    </div>
  )
}
