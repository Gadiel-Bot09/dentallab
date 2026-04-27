'use client'
// src/app/(interno)/inventario/_components/InventarioTable.tsx
import Link from 'next/link'

interface Material {
  id: string
  codigo: string
  nombre: string
  categoria: { nombre: string }
  unidad_medida: { nombre: string }
  stock_actual: number
  stock_minimo: number
  precio_unitario: number
  precio_venta_referencia: number
}

export default function InventarioTable({
  materials,
  userRol,
}: {
  materials: Material[]
  userRol: string
}) {
  const fmtCOP = (v: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)

  if (materials.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-16 text-center text-slate-500">
        <p className="text-4xl mb-3">📦</p>
        <p className="font-medium">No se encontraron materiales</p>
        {userRol === 'admin' && (
          <Link href="/inventario/nuevo" className="inline-block mt-4 text-sky-400 hover:text-sky-300 text-sm">
            + Registrar primer material →
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left">
              {['Código', 'Material', 'Categoría', 'Stock Actual', 'Mín.', 'Estado', 'P. Unitario', 'Valor Stock', ''].map((h) => (
                <th key={h} className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {materials.map((m) => {
              const isOut = m.stock_actual === 0
              const isLow = !isOut && m.stock_actual <= m.stock_minimo
              const valor = m.stock_actual * m.precio_unitario

              return (
                <tr
                  key={m.id}
                  className={`hover:bg-slate-800/30 transition-colors ${isOut ? 'bg-red-500/5' : isLow ? 'bg-amber-500/5' : ''}`}
                >
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{m.codigo}</td>
                  <td className="px-5 py-3 text-white font-medium">{m.nombre}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded-lg text-xs">
                      {m.categoria?.nombre || 'S/N'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`font-mono font-bold ${isOut ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {m.stock_actual}
                    </span>
                    <span className="text-slate-500 text-xs ml-1">{m.unidad_medida?.nombre || ''}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs font-mono">
                    {m.stock_minimo} {m.unidad_medida?.nombre || ''}
                  </td>
                  <td className="px-5 py-3">
                    {isOut ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium">
                        🔴 Agotado
                      </span>
                    ) : isLow ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-medium">
                        ⚠ Stock Bajo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-medium">
                        ✅ Disponible
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-sm text-slate-300">{fmtCOP(m.precio_unitario)}</td>
                  <td className="px-5 py-3 font-mono text-sm text-slate-400">{fmtCOP(valor)}</td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/inventario/${m.id}`}
                      className="text-slate-500 hover:text-sky-400 transition-colors"
                    >
                      →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
