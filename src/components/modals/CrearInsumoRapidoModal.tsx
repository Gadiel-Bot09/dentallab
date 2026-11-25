'use client'
// src/components/modals/CrearInsumoRapidoModal.tsx
// Modal reutilizable para registrar rápidamente un Insumo (INS-XXXX),
// Medicamento (MED-XXXX) o Material de Laboratorio (MAT-XXXX).
// Atajos internos: Esc para cerrar · Alt+1 (Insumo) · Alt+2 (Medicamento) · Alt+3 (Material Lab).

import { useEffect, useState } from 'react'
import {
  CLASIFICACION_RIESGO_LABELS,
  CONDICION_ALMACENAMIENTO_LABELS,
  type ClasificacionRiesgo,
  type CondicionAlmacenamiento,
} from '@/types/farmacia'
import {
  TIPOS_ITEM_INVENTARIO,
  TIPOS_ITEM_ORDEN,
  type TipoItemInventario,
} from '@/lib/inventario-tipos'
import type { MaterialSearchOption } from '@/app/(interno)/_components/InsumoSearchSelect'
import {
  crearInsumoRapidoAction,
  obtenerCatalogosInsumoAction,
} from '@/app/(interno)/farmacia/stock/actions'

export interface CrearInsumoInitialData {
  nombre?: string
  tipo_item?: TipoItemInventario
  codigo_barras?: string
  registro_sanitario?: string
  laboratorio_fabricante?: string
  presentacion_comercial?: string
  condiciones_almacenamiento?: CondicionAlmacenamiento
  iva_porcentaje?: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreated?: (material: MaterialSearchOption) => void
  categorias?: { id: string; nombre: string }[]
  unidades?: { id: string; nombre: string; abreviatura?: string | null }[]
  initialData?: CrearInsumoInitialData
  targetRowLabel?: string
}

export default function CrearInsumoRapidoModal({
  isOpen,
  onClose,
  onCreated,
  categorias: propCategorias,
  unidades: propUnidades,
  initialData,
  targetRowLabel,
}: Props) {
  const [categorias, setCategorias] = useState(propCategorias || [])
  const [unidades, setUnidades] = useState(propUnidades || [])
  const [loadingCats, setLoadingCats] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    nombre: '',
    tipo_item: 'insumo' as TipoItemInventario,
    categoria_id: '',
    unidad_medida_id: '',
    codigo_barras: '',
    registro_sanitario: '',
    clasificacion_riesgo: 'insumo_general' as ClasificacionRiesgo,
    laboratorio_fabricante: '',
    presentacion_comercial: '',
    condiciones_almacenamiento: 'ambiente' as CondicionAlmacenamiento,
    iva_porcentaje: 0,
    requiere_lote: true,
    requiere_vencimiento: true,
  })

  // Sincronizar props si llegan desde la página padre
  useEffect(() => {
    if (propCategorias && propCategorias.length > 0) setCategorias(propCategorias)
  }, [propCategorias])

  useEffect(() => {
    if (propUnidades && propUnidades.length > 0) setUnidades(propUnidades)
  }, [propUnidades])

  // Cargar catálogos bajo demanda cuando se abre globalmente sin props
  useEffect(() => {
    if (!isOpen) return
    setError(null)

    const initialTipo = initialData?.tipo_item || 'insumo'
    setForm({
      nombre: initialData?.nombre || '',
      tipo_item: initialTipo,
      categoria_id: categorias[0]?.id || propCategorias?.[0]?.id || '',
      unidad_medida_id: unidades[0]?.id || propUnidades?.[0]?.id || '',
      codigo_barras: initialData?.codigo_barras || '',
      registro_sanitario: initialData?.registro_sanitario || '',
      clasificacion_riesgo: initialTipo === 'medicamento' ? 'medicamento' : 'insumo_general',
      laboratorio_fabricante: initialData?.laboratorio_fabricante || '',
      presentacion_comercial: initialData?.presentacion_comercial || '',
      condiciones_almacenamiento: initialData?.condiciones_almacenamiento || 'ambiente',
      iva_porcentaje: initialData?.iva_porcentaje ?? 0,
      requiere_lote: true,
      requiere_vencimiento: true,
    })

    if (
      (!propCategorias || propCategorias.length === 0) &&
      categorias.length === 0
    ) {
      setLoadingCats(true)
      obtenerCatalogosInsumoAction().then((res) => {
        setLoadingCats(false)
        if (res.success) {
          const cats = res.categorias || []
          const unis = res.unidades || []
          setCategorias(cats)
          setUnidades(unis)
          setForm((prev) => ({
            ...prev,
            categoria_id: prev.categoria_id || cats[0]?.id || '',
            unidad_medida_id: prev.unidad_medida_id || unis[0]?.id || '',
          }))
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Atajos de teclado dentro del modal: Esc para cerrar, Alt+1/2/3 para tipo de registro
  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      } else if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === '1') {
          e.preventDefault()
          setForm((prev) => ({
            ...prev,
            tipo_item: 'insumo',
            clasificacion_riesgo:
              prev.clasificacion_riesgo === 'medicamento' ? 'insumo_general' : prev.clasificacion_riesgo,
          }))
        } else if (e.key === '2') {
          e.preventDefault()
          setForm((prev) => ({
            ...prev,
            tipo_item: 'medicamento',
            clasificacion_riesgo: 'medicamento',
          }))
        } else if (e.key === '3') {
          e.preventDefault()
          setForm((prev) => ({
            ...prev,
            tipo_item: 'material',
            clasificacion_riesgo:
              prev.clasificacion_riesgo === 'medicamento' ? 'insumo_general' : prev.clasificacion_riesgo,
          }))
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.nombre.trim()) {
      setError('El nombre del insumo es obligatorio')
      return
    }
    if (!form.categoria_id) {
      setError('Selecciona una categoría')
      return
    }
    if (!form.unidad_medida_id) {
      setError('Selecciona una unidad de medida')
      return
    }

    setSaving(true)
    const res = await crearInsumoRapidoAction({
      nombre: form.nombre.trim(),
      tipo_item: form.tipo_item,
      categoria_id: form.categoria_id,
      unidad_medida_id: form.unidad_medida_id,
      codigo_barras: form.codigo_barras.trim() || undefined,
      registro_sanitario: form.registro_sanitario.trim() || undefined,
      clasificacion_riesgo: form.clasificacion_riesgo,
      laboratorio_fabricante: form.laboratorio_fabricante.trim() || undefined,
      presentacion_comercial: form.presentacion_comercial.trim() || undefined,
      condiciones_almacenamiento: form.condiciones_almacenamiento,
      iva_porcentaje: Number(form.iva_porcentaje) || 0,
      requiere_lote: form.requiere_lote,
      requiere_vencimiento: form.requiere_vencimiento,
    })
    setSaving(false)

    if (!res.success || !res.data) {
      setError(res.error || 'No se pudo registrar el insumo')
      return
    }

    onCreated?.(res.data)
    onClose()
  }

  const activeMeta = TIPOS_ITEM_INVENTARIO[form.tipo_item]

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-sky-500/30 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div>
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <span>✨</span>
              <span>Registrar Nuevo Insumo en Catálogo</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Se generará automáticamente su código{' '}
              <span className="font-mono font-bold text-emerald-400">
                {activeMeta.prefijo}-XXXX
              </span>{' '}
              {targetRowLabel
                ? `y quedará seleccionado en la ${targetRowLabel}.`
                : 'y quedará disponible de inmediato en Farmacia, Solicitudes e Inventario.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
            title="Cerrar (Esc)"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
              ⚠️ {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Selector visual de tipo de ítem */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Tipo de Registro y Prefijo de Código <span className="text-red-400">*</span>
                </label>
                <span className="hidden sm:inline text-[10px] text-slate-500 font-mono">
                  Atajos: Alt+1 / Alt+2 / Alt+3
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {TIPOS_ITEM_ORDEN.map((t, index) => {
                  const meta = TIPOS_ITEM_INVENTARIO[t]
                  const active = form.tipo_item === t
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          tipo_item: t,
                          clasificacion_riesgo:
                            t === 'medicamento'
                              ? 'medicamento'
                              : form.clasificacion_riesgo === 'medicamento'
                              ? 'insumo_general'
                              : form.clasificacion_riesgo,
                        })
                      }
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        active
                          ? meta.activeCardClass
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm">{meta.icono}</span>
                        <span className="font-mono text-[10px] font-bold opacity-90">
                          {meta.ejemplo}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs font-semibold leading-tight">{meta.corto}</p>
                        <span className="text-[9px] font-mono opacity-50 hidden sm:inline">
                          Alt+{index + 1}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nombre del Insumo / Medicamento <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Anestesia Lidocaína 2% con Epinefrina, Guantes Nitrilo M..."
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Categoría <span className="text-red-400">*</span>
              </label>
              <select
                required
                disabled={loadingCats}
                value={form.categoria_id}
                onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              >
                <option value="">
                  {loadingCats ? 'Cargando categorías...' : '-- Seleccionar categoría --'}
                </option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Unidad de Medida <span className="text-red-400">*</span>
              </label>
              <select
                required
                disabled={loadingCats}
                value={form.unidad_medida_id}
                onChange={(e) => setForm({ ...form, unidad_medida_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              >
                <option value="">
                  {loadingCats ? 'Cargando unidades...' : '-- Seleccionar unidad --'}
                </option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                    {u.abreviatura ? ` (${u.abreviatura})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Código de Barras (EAN / GS1)
              </label>
              <input
                type="text"
                value={form.codigo_barras}
                onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })}
                placeholder="Ej: 7701234567890"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Registro Sanitario INVIMA
              </label>
              <input
                type="text"
                value={form.registro_sanitario}
                onChange={(e) => setForm({ ...form, registro_sanitario: e.target.value })}
                placeholder="Ej: INVIMA 2023DM-0025142"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Clasificación de Riesgo
              </label>
              <select
                value={form.clasificacion_riesgo}
                onChange={(e) =>
                  setForm({
                    ...form,
                    clasificacion_riesgo: e.target.value as ClasificacionRiesgo,
                  })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              >
                {Object.entries(CLASIFICACION_RIESGO_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Fabricante / Marca
              </label>
              <input
                type="text"
                value={form.laboratorio_fabricante}
                onChange={(e) => setForm({ ...form, laboratorio_fabricante: e.target.value })}
                placeholder="Ej: 3M ESPE, Septodont"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Presentación Comercial
              </label>
              <input
                type="text"
                value={form.presentacion_comercial}
                onChange={(e) => setForm({ ...form, presentacion_comercial: e.target.value })}
                placeholder="Ej: Caja x 50, Jeringa x 4g"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Condición de Almacenamiento
              </label>
              <select
                value={form.condiciones_almacenamiento}
                onChange={(e) =>
                  setForm({
                    ...form,
                    condiciones_almacenamiento: e.target.value as CondicionAlmacenamiento,
                  })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              >
                {Object.entries(CONDICION_ALMACENAMIENTO_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Tarifa IVA por defecto
              </label>
              <select
                value={form.iva_porcentaje}
                onChange={(e) =>
                  setForm({
                    ...form,
                    iva_porcentaje: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              >
                <option value={0}>0% (Exento / Excluido)</option>
                <option value={5}>5% (Tarifa reducida)</option>
                <option value={19}>19% (Tarifa general)</option>
              </select>
            </div>

            <div className="flex flex-col justify-center gap-1.5 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requiere_lote}
                  onChange={(e) => setForm({ ...form, requiere_lote: e.target.checked })}
                  className="rounded border-slate-600 bg-slate-900 text-sky-500"
                />
                <span>Exigir número de lote</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requiere_vencimiento}
                  onChange={(e) => setForm({ ...form, requiere_vencimiento: e.target.checked })}
                  className="rounded border-slate-600 bg-slate-900 text-sky-500"
                />
                <span>Exigir fecha de vencimiento</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              Presiona <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">Esc</kbd> para cerrar
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || loadingCats}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-sky-600/20"
              >
                {saving
                  ? 'Registrando...'
                  : targetRowLabel
                  ? 'Crear y Seleccionar Insumo'
                  : 'Registrar en Catálogo'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
