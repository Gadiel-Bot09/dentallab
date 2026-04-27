'use client'
// src/app/(interno)/ordenes/nueva/_components/NuevaOrdenForm.tsx
import { useState, useTransition } from 'react'
import { crearOrdenAction } from '../../actions'

interface Paciente { id: string; nombre: string; apellido: string; numero_historia: string; cedula: string }
interface Odontologo { id: string; nombre: string; apellido: string }
interface Laboratorio { id: string; nombre: string }
interface Material { id: string; codigo: string; nombre: string; unidad_medida: string; precio_unitario: number; stock_actual: number }
interface MaterialSeleccionado { material_id: string; nombre: string; cantidad: number; precio_unitario: number; unidad_medida: string }

const TIPOS_TRABAJO = [
  'Placa Superior', 'Placa Inferior', 'Prótesis Parcial Superior', 'Prótesis Parcial Inferior',
  'Prótesis Total Superior', 'Prótesis Total Inferior', 'Corona Porcelana', 'Corona Metal-Porcelana',
  'Corona Zirconio', 'Puente fijo', 'Carilla Porcelana', 'Incrustación', 'Retenedor', 'Otro',
]

import CrearOdontologoModal from '@/components/modals/CrearOdontologoModal'

export default function NuevaOrdenForm({
  pacientes, initialOdontologos, laboratorios, inventario, especialidades
}: {
  pacientes: Paciente[]
  initialOdontologos: Odontologo[]
  laboratorios: Laboratorio[]
  inventario: Material[]
  especialidades: any[]
}) {
  const [isPending, startTransition] = useTransition()
  const [odontologos, setOdontologos] = useState(initialOdontologos)
  const [selectedOdontologo, setSelectedOdontologo] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [materialesSeleccionados, setMaterialesSeleccionados] = useState<MaterialSeleccionado[]>([])
  const [matSearchId, setMatSearchId] = useState('')
  const [matCantidad, setMatCantidad] = useState(1)
  const [precioVenta, setPrecioVenta] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [archivosSeleccionados, setArchivosSeleccionados] = useState<File[]>([])

  const costoMateriales = materialesSeleccionados.reduce(
    (acc, m) => acc + m.cantidad * m.precio_unitario, 0
  )
  const margen = precioVenta > 0
    ? ((precioVenta - costoMateriales) / precioVenta * 100).toFixed(1)
    : '0.0'

  function agregarMaterial() {
    const mat = inventario.find((m) => m.id === matSearchId)
    if (!mat) return
    if (materialesSeleccionados.find((m) => m.material_id === mat.id)) {
      alert('Ese material ya fue agregado. Modifica la cantidad directamente.')
      return
    }
    if (matCantidad > mat.stock_actual) {
      alert(`Stock insuficiente. Disponible: ${mat.stock_actual} ${mat.unidad_medida}`)
      return
    }
    setMaterialesSeleccionados((prev) => [
      ...prev,
      { material_id: mat.id, nombre: mat.nombre, cantidad: matCantidad, precio_unitario: mat.precio_unitario, unidad_medida: mat.unidad_medida },
    ])
    setMatSearchId('')
    setMatCantidad(1)
  }

  function quitarMaterial(id: string) {
    setMaterialesSeleccionados((prev) => prev.filter((m) => m.material_id !== id))
  }

  const formatCOP = (v: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('materiales', JSON.stringify(materialesSeleccionados))
    fd.set('precio_venta', String(precioVenta))

    startTransition(async () => {
      try {
        await crearOrdenAction(fd)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error desconocido al crear la orden')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Section: Patient & Doctor */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-white text-sm uppercase tracking-wider">
          1. Paciente y Odontólogo
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Paciente *</label>
            <select
              id="paciente_id"
              name="paciente_id"
              required
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            >
              <option value="">— Seleccionar paciente —</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.apellido}, {p.nombre} — {p.numero_historia} (CC: {p.cedula})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Odontólogo tratante *</label>
            <div className="flex gap-2">
              <select
                id="odontologo_id"
                name="odontologo_id"
                required
                value={selectedOdontologo}
                onChange={(e) => setSelectedOdontologo(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              >
                <option value="">— Seleccionar odontólogo —</option>
                {odontologos.map((o) => (
                  <option key={o.id} value={o.id}>{o.apellido}, {o.nombre}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="shrink-0 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-sky-400 rounded-xl text-sm font-bold transition-colors"
                title="Crear Odontólogo Rápido"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Lab & Work */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-white text-sm uppercase tracking-wider">
          2. Laboratorio y Trabajo
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Laboratorio *</label>
            <select
              id="laboratorio_id"
              name="laboratorio_id"
              required
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            >
              <option value="">— Seleccionar laboratorio —</option>
              {laboratorios.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Tipo de trabajo *</label>
            <select
              id="tipo_trabajo"
              name="tipo_trabajo"
              required
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            >
              <option value="">— Seleccionar tipo —</option>
              {TIPOS_TRABAJO.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Descripción del trabajo</label>
            <textarea
              id="descripcion"
              name="descripcion"
              rows={3}
              placeholder="Especificaciones generales del trabajo..."
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Observaciones técnicas</label>
            <textarea
              id="observaciones_tecnicas"
              name="observaciones_tecnicas"
              rows={3}
              placeholder="Indicaciones especiales para el laboratorio..."
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 resize-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">Fecha estimada de entrega</label>
          <input
            type="date"
            id="fecha_estimada_entrega"
            name="fecha_estimada_entrega"
            min={new Date().toISOString().split('T')[0]}
            className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
        </div>
        <input type="hidden" name="modo_gestion" value="gestion_interna" />
      </div>

      {/* Section: Materials */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-white text-sm uppercase tracking-wider">
          3. Materiales (descontarán del inventario)
        </h2>

        {/* Add material row */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-500 mb-1">Material</label>
            <select
              value={matSearchId}
              onChange={(e) => setMatSearchId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            >
              <option value="">— Seleccionar material —</option>
              {inventario.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} ({m.codigo}) — Stock: {m.stock_actual} {m.unidad_medida}
                </option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-xs text-slate-500 mb-1">Cantidad</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={matCantidad}
              onChange={(e) => setMatCantidad(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          </div>
          <button
            type="button"
            onClick={agregarMaterial}
            disabled={!matSearchId || matCantidad <= 0}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
          >
            + Agregar
          </button>
        </div>

        {/* Materials list */}
        {materialesSeleccionados.length > 0 ? (
          <div className="space-y-2">
            {materialesSeleccionados.map((m) => (
              <div key={m.material_id} className="flex items-center justify-between bg-slate-800/60 rounded-xl px-4 py-3">
                <div>
                  <p className="text-white text-sm font-medium">{m.nombre}</p>
                  <p className="text-slate-400 text-xs">
                    {m.cantidad} {m.unidad_medida} × {formatCOP(m.precio_unitario)} = {formatCOP(m.cantidad * m.precio_unitario)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => quitarMaterial(m.material_id)}
                  className="text-slate-500 hover:text-red-400 text-sm transition-colors px-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-600 text-sm text-center py-4">No se han agregado materiales</p>
        )}
      </div>

      {/* Section: Documents/Photos */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-white text-sm uppercase tracking-wider">
          4. Archivos Adjuntos (Fotos, Especificaciones)
        </h2>
        <div className="space-y-3">
          <label className="flex items-center justify-center w-full px-4 py-8 border-2 border-dashed border-slate-700 hover:border-sky-500/50 hover:bg-sky-500/5 rounded-2xl cursor-pointer transition-all group">
            <div className="text-center">
              <p className="text-2xl mb-2">📎</p>
              <p className="text-sm font-medium text-slate-300 group-hover:text-sky-400">
                Haz clic para seleccionar archivos
              </p>
              <p className="text-xs text-slate-500 mt-1">PDF, JPG, PNG, WEBP (Máx. 10MB por archivo)</p>
            </div>
            <input
              type="file"
              name="archivos"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  setArchivosSeleccionados(Array.from(e.target.files))
                }
              }}
            />
          </label>

          {archivosSeleccionados.length > 0 && (
            <div className="bg-slate-800/40 rounded-xl p-3">
              <p className="text-xs font-medium text-slate-400 mb-2">Archivos seleccionados:</p>
              <ul className="space-y-1">
                {archivosSeleccionados.map((file, i) => (
                  <li key={i} className="text-sm text-slate-300 flex justify-between items-center bg-slate-800/80 px-3 py-2 rounded-lg">
                    <span className="truncate max-w-[80%]">{file.name}</span>
                    <span className="text-xs text-slate-500 shrink-0">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Section: Pricing */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-white text-sm uppercase tracking-wider">
          5. Precio y Rentabilidad
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800/60 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Costo materiales</p>
            <p className="text-lg font-bold text-white">{formatCOP(costoMateriales)}</p>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Precio de venta al paciente (COP)</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={precioVenta}
              onChange={(e) => setPrecioVenta(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          </div>
          <div className="bg-slate-800/60 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Margen estimado</p>
            <p className={`text-lg font-bold ${parseFloat(margen) >= 30 ? 'text-emerald-400' : parseFloat(margen) >= 15 ? 'text-amber-400' : 'text-red-400'}`}>
              {margen}%
            </p>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <a
          href="/ordenes"
          className="px-6 py-2.5 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-xl text-sm transition-all"
        >
          Cancelar
        </a>
        <button
          id="btn-crear-orden"
          type="submit"
          disabled={isPending}
          className="px-8 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-sky-500/20 transition-all duration-200 disabled:opacity-60"
        >
          {isPending ? 'Creando orden...' : 'Crear Orden →'}
        </button>
      </div>

      <CrearOdontologoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        especialidades={especialidades}
        laboratorios={laboratorios}
        onSuccess={(nuevo) => {
          setOdontologos(prev => [...prev, nuevo].sort((a, b) => a.apellido.localeCompare(b.apellido)))
          setSelectedOdontologo(nuevo.id)
          setIsModalOpen(false)
        }}
      />
    </form>
  )
}
