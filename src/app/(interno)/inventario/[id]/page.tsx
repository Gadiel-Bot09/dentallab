// src/app/(interno)/inventario/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const metadata: Metadata = {
  title: 'Detalle de Material — DentalLab Manager',
}

function fmtCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
}

export default async function InventarioDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const { data: material } = await supabase
    .from('inventario')
    .select('*')
    .eq('id', id)
    .single()

  if (!material) notFound()

  // Movimientos recientes
  const { data: movimientos } = await supabase
    .from('movimientos_inventario')
    .select('id, tipo, cantidad, stock_anterior, stock_resultante, motivo, created_at, orden_id, usuarios!usuario_id(nombre, apellido)')
    .eq('material_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  const isLow = material.stock_actual <= material.stock_minimo
  const isOut = material.stock_actual === 0

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <a href="/inventario" className="text-slate-500 hover:text-sky-400 text-sm transition-colors">← Volver a Inventario</a>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{material.nombre}</h1>
            <span className="bg-sky-500/20 text-sky-400 px-3 py-1 rounded-lg text-sm font-mono font-bold">
              {material.codigo}
            </span>
            {isOut ? (
              <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded-md text-xs font-medium border border-red-500/20">Agotado</span>
            ) : isLow ? (
              <span className="bg-amber-500/20 text-amber-400 px-2 py-1 rounded-md text-xs font-medium border border-amber-500/20">Stock Bajo</span>
            ) : null}
          </div>
          <p className="text-slate-400 text-sm mt-1">{material.categoria} · {material.unidad_medida}</p>
        </div>
        
        <div className="flex gap-2">
          {/* Aquí iría un botón para 'Ajustar Stock' (Próximamente) */}
          <button disabled className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-medium opacity-50 cursor-not-allowed">
            Editar Material
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-5">Detalles del Insumo</h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs">Stock Actual</p>
              <p className={`font-mono text-xl font-bold mt-1 ${isOut ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                {material.stock_actual} <span className="text-sm font-normal text-slate-500">{material.unidad_medida}</span>
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Stock Mínimo (Alerta)</p>
              <p className="font-mono text-slate-300 mt-0.5">{material.stock_minimo} {material.unidad_medida}</p>
            </div>
            
            <div className="pt-4 border-t border-slate-800">
              <p className="text-slate-500 text-xs">Costo Unitario</p>
              <p className="text-white font-mono mt-0.5">{fmtCOP(material.precio_unitario)}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Precio de Venta (Referencia)</p>
              <p className="text-slate-300 font-mono mt-0.5">{fmtCOP(material.precio_venta_referencia)}</p>
            </div>

            {material.descripcion && (
              <div className="pt-4 border-t border-slate-800">
                <p className="text-slate-500 text-xs">Descripción</p>
                <p className="text-slate-300 mt-1 text-xs leading-relaxed">{material.descripcion}</p>
              </div>
            )}
          </div>
        </div>

        {/* History / Movimientos */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-white">Historial de Movimientos</h2>

          {!movimientos || movimientos.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
              <p className="text-3xl mb-2">📊</p>
              <p className="text-sm">No se han registrado movimientos para este material.</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left bg-slate-800/20">
                    <th className="px-4 py-3 text-slate-500 font-medium text-xs uppercase">Fecha</th>
                    <th className="px-4 py-3 text-slate-500 font-medium text-xs uppercase">Tipo</th>
                    <th className="px-4 py-3 text-slate-500 font-medium text-xs uppercase text-right">Cant.</th>
                    <th className="px-4 py-3 text-slate-500 font-medium text-xs uppercase text-right">Stock Final</th>
                    <th className="px-4 py-3 text-slate-500 font-medium text-xs uppercase">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {movimientos.map((mov: any) => {
                    const isEntrada = mov.tipo === 'entrada' || mov.tipo === 'devolucion'
                    const isSalida = mov.tipo === 'salida'
                    
                    return (
                      <tr key={mov.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {format(new Date(mov.created_at), 'dd/MM/yy HH:mm')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${
                            isEntrada ? 'bg-emerald-500/10 text-emerald-400' :
                            isSalida ? 'bg-amber-500/10 text-amber-400' : 'bg-sky-500/10 text-sky-400'
                          }`}>
                            {mov.tipo}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-medium ${isEntrada ? 'text-emerald-400' : isSalida ? 'text-amber-400' : 'text-slate-300'}`}>
                          {isEntrada ? '+' : isSalida ? '-' : ''}{mov.cantidad}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-300">{mov.stock_resultante}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-[120px]">
                            {mov.usuarios?.nombre} {mov.usuarios?.apellido}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
