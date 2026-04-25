// src/app/(interno)/reportes/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reportes — DentalLab Manager',
}

export default async function ReportesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (profile?.rol !== 'admin' && profile?.rol !== 'odontologo') {
    redirect('/dashboard')
  }

  // Obtener todas las órdenes
  const { data: ordenes } = await supabase
    .from('ordenes_servicio')
    .select('*, laboratorios(nombre)')
  
  const totalOrdenes = ordenes?.length || 0
  
  // Órdenes activas (sin contar canceladas o borradores si se prefiere)
  const ordenesActivas = ordenes?.filter(o => o.estado !== 'borrador' && o.estado !== 'cancelada') || []
  
  // Ingresos Totales Estimados (sumando precio_venta de activas o entregadas)
  const ingresosEstimados = ordenesActivas.reduce((sum, o) => sum + Number(o.precio_venta || 0), 0)
  const costosEstimados = ordenesActivas.reduce((sum, o) => sum + Number(o.costo_total_materiales || 0), 0)

  // Órdenes por estado
  const conteoPorEstado = ordenes?.reduce((acc: any, o) => {
    acc[o.estado] = (acc[o.estado] || 0) + 1
    return acc
  }, {})

  // Top Laboratorios
  const conteoPorLab = ordenes?.reduce((acc: any, o) => {
    const labName = o.laboratorios?.nombre || 'Desconocido'
    acc[labName] = (acc[labName] || 0) + 1
    return acc
  }, {})

  const topLaboratorios = Object.entries(conteoPorLab || {})
    .sort(([, a]: any, [, b]: any) => b - a)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Reportes y Métricas</h1>
        <p className="text-slate-400 text-sm mt-1">Visión general del rendimiento del laboratorio y finanzas.</p>
      </div>

      {/* Tarjetas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-sm font-medium text-slate-400 mb-1">Ingresos Estimados</p>
          <p className="text-2xl font-bold text-white">${ingresosEstimados.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-sm font-medium text-slate-400 mb-1">Costos Materiales</p>
          <p className="text-2xl font-bold text-white">${costosEstimados.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-sm font-medium text-slate-400 mb-1">Total Órdenes</p>
          <p className="text-2xl font-bold text-white">{totalOrdenes}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-sm font-medium text-slate-400 mb-1">Órdenes en Proceso</p>
          <p className="text-2xl font-bold text-sky-400">
            {conteoPorEstado?.['en_proceso'] || 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico/Tabla: Órdenes por estado */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Órdenes por Estado</h2>
          <div className="space-y-3">
            {Object.entries(conteoPorEstado || {}).map(([estado, count]: any) => (
              <div key={estado} className="flex items-center justify-between">
                <span className="text-sm text-slate-300 capitalize">{estado.replace('_', ' ')}</span>
                <div className="flex items-center gap-3 w-2/3">
                  <div className="h-2 rounded-full bg-slate-800 w-full overflow-hidden">
                    <div 
                      className="h-full bg-sky-500 rounded-full" 
                      style={{ width: `${(count / totalOrdenes) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-white min-w-[2rem] text-right">{count}</span>
                </div>
              </div>
            ))}
            {Object.keys(conteoPorEstado || {}).length === 0 && (
              <p className="text-slate-500 text-sm text-center py-4">No hay datos disponibles</p>
            )}
          </div>
        </div>

        {/* Top Laboratorios */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Top Clínicas / Laboratorios</h2>
          <div className="space-y-4">
            {topLaboratorios.map(([nombre, count]: any, index) => (
              <div key={nombre} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-xs font-bold text-slate-400">
                    {index + 1}
                  </span>
                  <span className="text-sm text-slate-300">{nombre}</span>
                </div>
                <span className="text-sm font-bold text-white">{count} órdenes</span>
              </div>
            ))}
            {topLaboratorios.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-4">No hay datos disponibles</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
