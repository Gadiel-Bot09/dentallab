// src/app/(interno)/dashboard/_components/LowStockAlert.tsx
import Link from 'next/link'

interface Material {
  id: string
  nombre: string
  stock_actual: number
  stock_minimo: number
  unidad_medida: string
  categoria: string
}

export default function LowStockAlert({ materials }: { materials: Material[] }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-white text-sm">Stock Bajo</h2>
          {materials.length > 0 && (
            <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full border border-red-500/20">
              {materials.length}
            </span>
          )}
        </div>
        <Link href="/inventario" className="text-sky-400 hover:text-sky-300 text-xs transition-colors">
          Gestionar →
        </Link>
      </div>

      {materials.length === 0 ? (
        <div className="px-5 py-10 text-center text-slate-500">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-xs">Inventario en niveles adecuados</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800">
          {materials.map((m) => {
            const pct = m.stock_minimo > 0 ? (m.stock_actual / m.stock_minimo) * 100 : 0
            const isOut = m.stock_actual === 0
            return (
              <div key={m.id} className="px-5 py-3">
                <div className="flex items-start justify-between mb-1.5 gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{m.nombre}</p>
                    <p className="text-xs text-slate-500">{m.categoria}</p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-lg ${
                      isOut
                        ? 'bg-red-500/20 text-red-400 border border-red-500/20'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {isOut ? 'AGOTADO' : 'BAJO'}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-800 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${isOut ? 'bg-red-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {m.stock_actual} / {m.stock_minimo} {m.unidad_medida} (mín.)
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
