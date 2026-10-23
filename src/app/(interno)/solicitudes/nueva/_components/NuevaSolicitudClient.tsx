'use client'
// src/app/(interno)/solicitudes/nueva/_components/NuevaSolicitudClient.tsx
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Area, Farmacia } from '@/types/database'
import { guardarSolicitudAction } from '../../actions'
import InsumoSearchSelect from '@/app/(interno)/_components/InsumoSearchSelect'

interface MaterialOption {
  id: string
  codigo: string
  nombre: string
  categoria?: { nombre: string } | null
  unidad_medida?: { nombre: string; abreviatura: string | null } | null
  precio_unitario: number
}

interface StockMapEntry {
  cantidad: number
}

interface SolicitudItemRow {
  material_id: string
  cantidad: number
  observaciones: string
}

interface Props {
  areas: Area[]
  farmacias: Farmacia[]
  materials: MaterialOption[]
  stockMap: Record<string, Record<string, number>> // farmacia_id -> { material_id: cantidad }
  initialData?: {
    area_id?: string
    farmacia_id?: string
    tipo?: 'puntual' | 'semanal' | 'mensual'
    prioridad?: 'normal' | 'urgente'
    periodo_inicio?: string
    periodo_fin?: string
    observaciones?: string
    items?: SolicitudItemRow[]
  }
}

export default function NuevaSolicitudClient({
  areas,
  farmacias,
  materials,
  stockMap,
  initialData,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [areaId, setAreaId] = useState(initialData?.area_id || (areas[0]?.id ?? ''))
  const [farmaciaId, setFarmaciaId] = useState(initialData?.farmacia_id || (farmacias[0]?.id ?? ''))
  const [tipo, setTipo] = useState<'puntual' | 'semanal' | 'mensual'>(initialData?.tipo || 'puntual')
  const [prioridad, setPrioridad] = useState<'normal' | 'urgente'>(initialData?.prioridad || 'normal')
  const [periodoInicio, setPeriodoInicio] = useState(initialData?.periodo_inicio || '')
  const [periodoFin, setPeriodoFin] = useState(initialData?.periodo_fin || '')
  const [observaciones, setObservaciones] = useState(initialData?.observaciones || '')

  const [items, setItems] = useState<SolicitudItemRow[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items
      : [{ material_id: '', cantidad: 1, observaciones: '' }]
  )

  function addItem() {
    setItems([...items, { material_id: '', cantidad: 1, observaciones: '' }])
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: keyof SolicitudItemRow, value: any) {
    const next = [...items]
    next[index] = { ...next[index], [field]: value }
    setItems(next)
  }

  async function handleSubmit(enviar: boolean) {
    setError(null)

    if (!areaId) {
      setError('Debes seleccionar un área solicitante')
      return
    }
    if (!farmaciaId) {
      setError('Debes seleccionar una farmacia destino')
      return
    }
    if (tipo !== 'puntual' && (!periodoInicio || !periodoFin)) {
      setError('Las solicitudes semanales o mensuales requieren especificar fecha de inicio y fin')
      return
    }

    const validItems = items.filter((i) => i.material_id && i.cantidad > 0)
    if (validItems.length === 0) {
      setError('Debes agregar al menos un insumo con cantidad mayor a cero')
      return
    }

    // Verificar repetidos
    const setMat = new Set(validItems.map((i) => i.material_id))
    if (setMat.size !== validItems.length) {
      setError('Tienes insumos duplicados en la lista. Por favor agrúpalos en una sola fila.')
      return
    }

    startTransition(async () => {
      const res = await guardarSolicitudAction({
        areaId,
        farmaciaId,
        tipo,
        prioridad,
        periodoInicio: tipo !== 'puntual' ? periodoInicio : null,
        periodoFin: tipo !== 'puntual' ? periodoFin : null,
        observaciones: observaciones || null,
        items: validItems,
        enviar,
      })

      if (!res.success) {
        setError(res.error || 'Error al procesar la solicitud')
      } else {
        router.push(`/solicitudes/${res.data.id}`)
      }
    })
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-2xl flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* Cabecera del formulario */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-5">
        <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
          <span>📋</span>
          <span>Datos Generales de la Solicitud</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Área Solicitante <span className="text-red-400">*</span>
            </label>
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.codigo} — {a.nombre} {a.centro_costo ? `(${a.centro_costo})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Farmacia Destino <span className="text-red-400">*</span>
            </label>
            <select
              value={farmaciaId}
              onChange={(e) => setFarmaciaId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            >
              {farmacias.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.codigo} — {f.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Tipo de Pedido
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            >
              <option value="puntual">Puntual / Inmediato (Para el día)</option>
              <option value="semanal">Programado Semanal (Insumos para la semana)</option>
              <option value="mensual">Programado Mensual (Dotación del mes)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Prioridad
            </label>
            <select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as any)}
              className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 ${
                prioridad === 'urgente'
                  ? 'border-red-500/50 text-red-400 focus:ring-red-500/40'
                  : 'border-slate-800 text-white focus:ring-sky-500/40'
              }`}
            >
              <option value="normal">Normal</option>
              <option value="urgente">🚨 Urgente / Prioritario</option>
            </select>
          </div>
        </div>

        {tipo !== 'puntual' && (
          <div className="p-4 bg-sky-500/5 border border-sky-500/20 rounded-xl space-y-3">
            <p className="text-xs text-sky-400 font-medium">
              📅 Especifica el rango de fechas para el cual se requieren estos insumos:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fecha de Inicio</label>
                <input
                  type="date"
                  value={periodoInicio}
                  onChange={(e) => setPeriodoInicio(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fecha de Fin</label>
                <input
                  type="date"
                  value={periodoFin}
                  onChange={(e) => setPeriodoFin(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Observaciones o Justificación General
          </label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            placeholder="Motivo del pedido, paciente específico o necesidad del área..."
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/40 resize-none"
          />
        </div>
      </div>

      {/* Tabla de Insumos */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>📦</span>
              <span>Insumos Solicitados</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              El stock disponible indicado corresponde a la farmacia seleccionada.
            </p>
          </div>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 rounded-xl text-xs font-medium transition-colors"
          >
            <span>➕</span>
            <span>Agregar Insumo</span>
          </button>
        </div>

        <div className="space-y-2.5">
          {items.map((item, idx) => {
            const selectedMat = materials.find((m) => m.id === item.material_id)
            const availableStock =
              farmaciaId && item.material_id
                ? stockMap[farmaciaId]?.[item.material_id] ?? 0
                : 0

            return (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2.5 items-start bg-slate-950/70 p-3 rounded-xl border border-slate-800/80"
              >
                {/* Selector de Insumo con Buscador */}
                <div className="col-span-12 sm:col-span-5">
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Insumo <span className="text-red-400">*</span>
                  </label>
                  <InsumoSearchSelect
                    materials={materials}
                    value={item.material_id}
                    onChange={(matId) => updateItem(idx, 'material_id', matId)}
                    stockMap={farmaciaId ? stockMap[farmaciaId] : undefined}
                    placeholder="🔍 Buscar por código (ej: MAT-0001) o nombre..."
                  />
                  {selectedMat && (
                    <div className="flex items-center gap-2 mt-1 text-[11px]">
                      <span className="text-slate-500">Unidad: {selectedMat.unidad_medida?.nombre || 'Und'}</span>
                      <span className="text-slate-600">·</span>
                      <span className={availableStock > 0 ? 'text-emerald-400' : 'text-red-400 font-semibold'}>
                        Stock Farmacia: {availableStock} {selectedMat.unidad_medida?.abreviatura || 'Und'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Cantidad Solicitada */}
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-[11px] text-slate-400 mb-1">Cantidad</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={item.cantidad}
                    onChange={(e) => updateItem(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                    placeholder="1"
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white text-right font-bold"
                  />
                </div>

                {/* Observación específica */}
                <div className="col-span-5 sm:col-span-4">
                  <label className="block text-[11px] text-slate-400 mb-1">Detalle / Nota</label>
                  <input
                    type="text"
                    value={item.observaciones}
                    onChange={(e) => updateItem(idx, 'observaciones', e.target.value)}
                    placeholder="Ej: Calibre 21, color A2, etc."
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600"
                  />
                </div>

                {/* Quitar fila */}
                <div className="col-span-1 text-center pt-6">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-red-400 hover:text-red-300 p-1"
                      title="Quitar de la lista"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Botones de Envío */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-xl transition-colors"
        >
          ← Cancelar
        </button>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleSubmit(false)}
            className="flex-1 sm:flex-initial px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm rounded-xl transition-all"
          >
            {isPending ? 'Guardando...' : 'Guardar como Borrador'}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleSubmit(true)}
            className="flex-1 sm:flex-initial px-6 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-sky-500/20 transition-all"
          >
            {isPending ? 'Enviando...' : '🚀 Enviar a Farmacia'}
          </button>
        </div>
      </div>
    </div>
  )
}
