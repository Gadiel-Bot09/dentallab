'use client'
// src/app/(interno)/inventario/nuevo/_components/NuevoMaterialForm.tsx
import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { crearMaterialAction } from '../../actions'
import CrearCategoriaInventarioModal from '@/components/modals/CrearCategoriaInventarioModal'
import CrearUnidadMedidaModal from '@/components/modals/CrearUnidadMedidaModal'
import { CLASIFICACION_RIESGO_LABELS, CONDICION_ALMACENAMIENTO_LABELS } from '@/types/farmacia'

export default function NuevoMaterialForm({
  initialCategorias,
  initialUnidades
}: {
  initialCategorias: { id: string; nombre: string }[]
  initialUnidades: { id: string; nombre: string }[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [categorias, setCategorias] = useState(initialCategorias)
  const [unidades, setUnidades] = useState(initialUnidades)

  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('')
  const [unidadSeleccionada, setUnidadSeleccionada] = useState('')

  const [isModalCategoriaOpen, setIsModalCategoriaOpen] = useState(false)
  const [isModalUnidadOpen, setIsModalUnidadOpen] = useState(false)

  useEffect(() => {
    setCategorias(initialCategorias)
  }, [initialCategorias])

  useEffect(() => {
    setUnidades(initialUnidades)
  }, [initialUnidades])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await crearMaterialAction(fd)
      } catch (err: any) {
        setError(err.message)
      }
    })
  }

  return (
    <>
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
              disabled
              value="Se generará automáticamente (Ej. MAT-0001)"
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-500 text-sm cursor-not-allowed"
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
            <div className="flex gap-2">
              <select
                name="categoria_id"
                required
                value={categoriaSeleccionada}
                onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              >
                <option value="">Selecciona categoría</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setIsModalCategoriaOpen(true)}
                className="shrink-0 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-sky-400 rounded-xl text-sm font-bold transition-colors"
                title="Nueva Categoría"
              >
                +
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Unidad de Medida *</label>
            <div className="flex gap-2">
              <select
                name="unidad_medida_id"
                required
                value={unidadSeleccionada}
                onChange={(e) => setUnidadSeleccionada(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              >
                <option value="">Selecciona unidad</option>
                {unidades.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setIsModalUnidadOpen(true)}
                className="shrink-0 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-sky-400 rounded-xl text-sm font-bold transition-colors"
                title="Nueva Unidad de Medida"
              >
                +
              </button>
            </div>
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

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Cantidad a Ingresar *
              <span className="ml-2 text-xs font-normal text-sky-400 bg-sky-400/10 border border-sky-400/20 px-2 py-0.5 rounded-full">Stock inicial al registrar</span>
            </label>
            <input
              name="stock_inicial"
              type="number"
              step="0.01"
              required
              min="0"
              defaultValue="0"
              placeholder="Ej. 50"
              className="w-full px-4 py-2.5 bg-slate-900 border border-sky-500/30 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
            <p className="text-xs text-slate-500 mt-1.5">Esta cantidad se registrará como movimiento de entrada inicial. Puede ser 0 si aún no tienes stock disponible.</p>
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

        {/* Información Normativa y Trazabilidad INVIMA */}
        <div className="pt-5 border-t border-slate-800 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>🏥</span>
              <span>Información Normativa y Trazabilidad (INVIMA / Farmacia)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Estos datos se autocompletarán automáticamente al registrar entradas y compras en farmacia.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Código de Barras (EAN / GS1)</label>
              <input
                name="codigo_barras"
                type="text"
                placeholder="Ej: 7701234567890"
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Registro Sanitario INVIMA</label>
              <input
                name="registro_sanitario"
                type="text"
                placeholder="Ej: INVIMA 2023DM-0025142"
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Clasificación de Riesgo</label>
              <select
                name="clasificacion_riesgo"
                defaultValue="insumo_general"
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              >
                {Object.entries(CLASIFICACION_RIESGO_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Laboratorio / Fabricante</label>
              <input
                name="laboratorio_fabricante"
                type="text"
                placeholder="Ej: 3M ESPE, Septodont, Dentsply..."
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Presentación Comercial</label>
              <input
                name="presentacion_comercial"
                type="text"
                placeholder="Ej: Caja x 50 carpules, Jeringa x 4g"
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Condición de Almacenamiento</label>
              <select
                name="condiciones_almacenamiento"
                defaultValue="ambiente"
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              >
                {Object.entries(CONDICION_ALMACENAMIENTO_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Tarifa IVA (%)</label>
              <select
                name="iva_porcentaje"
                defaultValue="0"
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              >
                <option value="0">0% (Exento / Excluido)</option>
                <option value="5">5% (Tarifa reducida)</option>
                <option value="19">19% (Tarifa general)</option>
              </select>
            </div>

            <div className="flex flex-col justify-center gap-2 pt-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  name="requiere_lote"
                  defaultChecked
                  className="rounded border-slate-600 bg-slate-900 text-sky-500"
                />
                <span>Exigir número de lote al ingresar</span>
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  name="requiere_vencimiento"
                  defaultChecked
                  className="rounded border-slate-600 bg-slate-900 text-sky-500"
                />
                <span>Exigir fecha de vencimiento al ingresar</span>
              </label>
            </div>
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
            disabled={isPending}
            className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50"
          >
            {isPending ? 'Guardando...' : 'Crear Material'}
          </button>
        </div>
      </form>

      <CrearCategoriaInventarioModal
        isOpen={isModalCategoriaOpen}
        onClose={() => setIsModalCategoriaOpen(false)}
        onSuccess={(nuevoNombre) => {
          setIsModalCategoriaOpen(false)
          router.refresh()
          // En un sistema ideal, el action retornaría el UUID para seleccionarlo automáticamente.
          // Por simplicidad, el usuario deberá seleccionarlo tras la recarga silenciosa.
        }}
      />

      <CrearUnidadMedidaModal
        isOpen={isModalUnidadOpen}
        onClose={() => setIsModalUnidadOpen(false)}
        onSuccess={(nuevoNombre) => {
          setIsModalUnidadOpen(false)
          router.refresh()
        }}
      />
    </>
  )
}
