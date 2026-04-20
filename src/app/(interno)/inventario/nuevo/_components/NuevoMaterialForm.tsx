'use client'
// src/app/(interno)/inventario/nuevo/_components/NuevoMaterialForm.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { crearMaterialAction } from '../../actions'

export default function NuevoMaterialForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    try {
      await crearMaterialAction(fd)
      // Redirection is handled inside the action
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const categorias = ['resinas', 'metales', 'acrílicos', 'adhesivos', 'ceras', 'yesos', 'instrumentos', 'otros']

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Código Único *</label>
          <input
            name="codigo"
            required
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            placeholder="RES-001"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre del Material *</label>
          <input
            name="nombre"
            required
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            placeholder="Resina Fotocurable A2"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Descripción</label>
          <textarea
            name="descripcion"
            rows={2}
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 resize-none"
            placeholder="Detalles adicionales o características del material..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Categoría *</label>
          <select
            name="categoria"
            required
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          >
            <option value="">Selecciona categoría</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Unidad de Medida *</label>
          <input
            name="unidad_medida"
            required
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            placeholder="gr, ml, und..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Stock Mínimo Alerta *</label>
          <input
            name="stock_minimo"
            type="number"
            step="0.01"
            required
            defaultValue="10"
            min="0"
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          />
        </div>

        <div>
           {/* El inventario no debe crearse con stock, debe haber movimientos_inventario pero vamos a dar la opción de un salto de stock inicial para facilitar */}
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Stock Inicial (Opcional)</label>
          <input
            name="stock_inicial"
            type="number"
            step="0.01"
            min="0"
            defaultValue="0"
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Costo Unitario Promedio (COP) *</label>
          <input
            name="precio_unitario"
            type="number"
            required
            min="0"
            defaultValue="0"
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Precio de Venta Referencia (COP) *</label>
          <input
            name="precio_venta_referencia"
            type="number"
            required
            min="0"
            defaultValue="0"
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            placeholder="0"
          />
        </div>
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Crear Material'}
        </button>
      </div>
    </form>
  )
}
