// src/app/(interno)/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import StatCard from './_components/StatCard'
import RecentOrders from './_components/RecentOrders'
import LowStockAlert from './_components/LowStockAlert'

export const metadata: Metadata = {
  title: 'Dashboard — DentalLab Manager',
  description: 'Resumen operativo del centro odontológico',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── KPI data fetching ─────────────────────────────────────────────────────
  const [
    { count: ordenesActivas },
    { count: ordenesDemoradas },
    { data: inventario },
    { data: ordenesRecientes },
    { data: materialesBajos },
  ] = await Promise.all([
    // Active orders count
    supabase
      .from('ordenes_servicio')
      .select('*', { count: 'exact', head: true })
      .not('estado', 'in', '(entregada_paciente,cancelada)'),

    // Overdue orders (passed fecha_estimada_entrega without update)
    supabase
      .from('ordenes_servicio')
      .select('*', { count: 'exact', head: true })
      .lt('fecha_estimada_entrega', new Date().toISOString())
      .not('estado', 'in', '(entregada_paciente,cancelada,recibida_centro,enviada_centro)'),

    // Inventory valuation
    supabase.from('inventario').select('stock_actual, precio_unitario').eq('activo', true),

    // Recent 10 orders
    supabase
      .from('ordenes_servicio')
      .select('id, radicado, tipo_trabajo, estado, created_at, pacientes(nombre, apellido), laboratorios(nombre)')
      .order('created_at', { ascending: false })
      .limit(10),

    // Materials below minimum stock
    supabase
      .from('inventario')
      .select('id, nombre, stock_actual, stock_minimo, unidad_medida, categoria')
      .eq('activo', true)
      .filter('stock_actual', 'lte', 'stock_minimo'),
  ])

  const valorInventario = (inventario ?? []).reduce(
    (acc, item) => acc + item.stock_actual * item.precio_unitario,
    0
  )

  // Margin average for this month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: ordenesConMargen } = await supabase
    .from('ordenes_servicio')
    .select('margen_ganancia')
    .gte('created_at', startOfMonth.toISOString())
    .not('estado', 'eq', 'cancelada')

  const margenPromedio =
    ordenesConMargen && ordenesConMargen.length > 0
      ? ordenesConMargen.reduce((acc, o) => acc + o.margen_ganancia, 0) / ordenesConMargen.length
      : 0

  const formatCOP = (value: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">
          Resumen operativo — {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Bogota' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          id="kpi-ordenes-activas"
          label="Órdenes Activas"
          value={String(ordenesActivas ?? 0)}
          icon="📋"
          color="sky"
          href="/ordenes"
          detail="Ver todas las órdenes"
        />
        <StatCard
          id="kpi-ordenes-demoradas"
          label="Órdenes Demoradas"
          value={String(ordenesDemoradas ?? 0)}
          icon="⚠️"
          color={(ordenesDemoradas ?? 0) > 0 ? 'red' : 'emerald'}
          href="/ordenes?filtro=demoradas"
          detail={(ordenesDemoradas ?? 0) > 0 ? 'Requieren atención' : 'Todo al día'}
        />
        <StatCard
          id="kpi-valor-inventario"
          label="Valor Inventario"
          value={formatCOP(valorInventario)}
          icon="📦"
          color="violet"
          href="/inventario"
          detail="Stock actual valorizado"
        />
        <StatCard
          id="kpi-margen-promedio"
          label="Margen Promedio (mes)"
          value={`${margenPromedio.toFixed(1)}%`}
          icon="📈"
          color="emerald"
          href="/reportes/rentabilidad"
          detail="Órdenes del mes actual"
        />
      </div>

      {/* Alerts + Recent Orders Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent orders table */}
        <div className="xl:col-span-2">
          <RecentOrders orders={(ordenesRecientes as any[]) ?? []} />
        </div>

        {/* Low stock alert */}
        <div>
          <LowStockAlert materials={materialesBajos ?? []} />
        </div>
      </div>
    </div>
  )
}
