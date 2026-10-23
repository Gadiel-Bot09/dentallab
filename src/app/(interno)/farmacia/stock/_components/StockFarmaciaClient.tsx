'use client'
// src/app/(interno)/farmacia/stock/_components/StockFarmaciaClient.tsx
import { useState, useTransition } from 'react'
import type { Farmacia } from '@/types/database'
import {
  registrarEntradaAction,
  ajustarStockAction,
  trasladarStockAction,
  configurarStockAction,
} from '../actions'
import InsumoSearchSelect from '@/app/(interno)/_components/InsumoSearchSelect'

interface MaterialItem {
  id: string
  codigo: string
  nombre: string
  categoria?: { nombre: string } | null
  unidad_medida?: { nombre: string; abreviatura: string | null } | null
  precio_unitario: number
}

interface StockRow {
  material_id: string
  codigo: string
  nombre: string
  categoria: string
  unidad: string
  cantidad: number
  stock_minimo: number
  stock_maximo: number | null
  costo_promedio: number
}

interface Props {
  farmacias: Farmacia[]
  initialFarmaciaId: string
  stockList: StockRow[]
  allMaterials: MaterialItem[]
  userCanManage: boolean
}

function fmtCOP(v: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(v || 0)
}

export default function StockFarmaciaClient({
  farmacias,
  initialFarmaciaId,
  stockList,
  allMaterials,
  userCanManage,
}: Props) {
  const [selectedFarmaciaId, setSelectedFarmaciaId] = useState(initialFarmaciaId)
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'todos' | 'con_stock' | 'bajo_stock'>('todos')

  // Modales
  const [modalEntrada, setModalEntrada] = useState(false)
  const [modalAjuste, setModalAjuste] = useState<StockRow | null>(null)
  const [modalConfig, setModalConfig] = useState<StockRow | null>(null)
  const [modalTraslado, setModalTraslado] = useState(false)
  const [errorModal, setErrorModal] = useState<string | null>(null)

  // Estado formulario de entrada (compras)
  const [entradaProveedor, setEntradaProveedor] = useState('')
  const [entradaDoc, setEntradaDoc] = useState('')
  const [entradaObs, setEntradaObs] = useState('')
  const [entradaItems, setEntradaItems] = useState<
    { material_id: string; cantidad: number; costo_unitario: number }[]
  >([{ material_id: '', cantidad: 1, costo_unitario: 0 }])

  // Estado formulario de traslado
  const [trasladoDestino, setTrasladoDestino] = useState('')
  const [trasladoObs, setTrasladoObs] = useState('')
  const [trasladoItems, setTrasladoItems] = useState<
    { material_id: string; cantidad: number }[]
  >([{ material_id: '', cantidad: 1 }])

  const currentFarmacia = farmacias.find((f) => f.id === selectedFarmaciaId)

  // Filtrado de stock
  const filteredStock = stockList.filter((item) => {
    const matchesSearch =
      item.nombre.toLowerCase().includes(search.toLowerCase()) ||
      item.codigo.toLowerCase().includes(search.toLowerCase()) ||
      item.categoria.toLowerCase().includes(search.toLowerCase())

    if (!matchesSearch) return false

    if (filterType === 'con_stock') return item.cantidad > 0
    if (filterType === 'bajo_stock') return item.cantidad <= item.stock_minimo
    return true
  })

  // KPIs
  const totalInsumos = stockList.length
  const conStock = stockList.filter((s) => s.cantidad > 0).length
  const alertasBajoStock = stockList.filter((s) => s.cantidad <= s.stock_minimo).length
  const valorTotalInventario = stockList.reduce(
    (sum, s) => sum + s.cantidad * s.costo_promedio,
    0
  )

  function handleFarmaciaChange(newId: string) {
    setSelectedFarmaciaId(newId)
    window.location.href = `/farmacia/stock?farmacia_id=${newId}`
  }

  // Submit Entrada / Compra
  async function handleEntradaSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorModal(null)
    const validItems = entradaItems.filter((i) => i.material_id && i.cantidad > 0)
    if (validItems.length === 0) {
      setErrorModal('Agrega al menos un insumo con cantidad mayor a cero')
      return
    }

    startTransition(async () => {
      const res = await registrarEntradaAction(
        selectedFarmaciaId,
        validItems,
        entradaProveedor,
        entradaDoc,
        entradaObs
      )
      if (!res.success) {
        setErrorModal(res.error || 'Error al registrar entrada')
      } else {
        setModalEntrada(false)
        window.location.reload()
      }
    })
  }

  // Submit Ajuste físico
  async function handleAjusteSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!modalAjuste) return
    setErrorModal(null)
    const fd = new FormData(e.currentTarget)
    const cantidadReal = parseFloat(fd.get('cantidad_real') as string)
    const motivo = fd.get('motivo') as string

    startTransition(async () => {
      const res = await ajustarStockAction(
        selectedFarmaciaId,
        modalAjuste.material_id,
        cantidadReal,
        motivo
      )
      if (!res.success) {
        setErrorModal(res.error || 'Error al ajustar stock')
      } else {
        setModalAjuste(null)
        window.location.reload()
      }
    })
  }

  // Submit Configurar Mínimos
  async function handleConfigSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!modalConfig) return
    setErrorModal(null)
    const fd = new FormData(e.currentTarget)
    const minimo = parseFloat(fd.get('stock_minimo') as string) || 0
    const maximoStr = fd.get('stock_maximo') as string
    const maximo = maximoStr ? parseFloat(maximoStr) : null

    startTransition(async () => {
      const res = await configurarStockAction(
        selectedFarmaciaId,
        modalConfig.material_id,
        minimo,
        maximo
      )
      if (!res.success) {
        setErrorModal(res.error || 'Error al configurar stock')
      } else {
        setModalConfig(null)
        window.location.reload()
      }
    })
  }

  // Submit Traslado
  async function handleTrasladoSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorModal(null)
    if (!trasladoDestino) {
      setErrorModal('Selecciona la farmacia de destino')
      return
    }
    const validItems = trasladoItems.filter((i) => i.material_id && i.cantidad > 0)
    if (validItems.length === 0) {
      setErrorModal('Agrega al menos un insumo con cantidad mayor a cero')
      return
    }

    startTransition(async () => {
      const res = await trasladarStockAction(
        selectedFarmaciaId,
        trasladoDestino,
        validItems,
        trasladoObs
      )
      if (!res.success) {
        setErrorModal(res.error || 'Error al realizar traslado')
      } else {
        alert(`Traslado registrado exitosamente. Documento: ${res.radicado}`)
        setModalTraslado(false)
        window.location.reload()
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Selector de Farmacia y Acciones Principales */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏥</span>
          <div>
            <label className="text-xs font-medium text-slate-400 block">Farmacia Activa</label>
            <select
              value={selectedFarmaciaId}
              onChange={(e) => handleFarmaciaChange(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-white font-bold text-base rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-emerald-500/40"
            >
              {farmacias.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.codigo} — {f.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {userCanManage && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setErrorModal(null)
                setEntradaItems([{ material_id: '', cantidad: 1, costo_unitario: 0 }])
                setModalEntrada(true)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
            >
              <span>📥</span>
              <span>Registrar Entrada / Compra</span>
            </button>
            {farmacias.length > 1 && (
              <button
                onClick={() => {
                  setErrorModal(null)
                  setTrasladoDestino('')
                  setTrasladoItems([{ material_id: '', cantidad: 1 }])
                  setModalTraslado(true)
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition-all"
              >
                <span>🔄</span>
                <span>Traslado entre Farmacias</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400 font-medium">Insumos en Catálogo</p>
          <p className="text-2xl font-bold text-white mt-1">{totalInsumos}</p>
          <p className="text-xs text-slate-500 mt-1">{conStock} con stock disponible</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400 font-medium">Alertas Stock Mínimo</p>
          <p className={`text-2xl font-bold mt-1 ${alertasBajoStock > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
            {alertasBajoStock}
          </p>
          <p className="text-xs text-slate-500 mt-1">Por reabastecer</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400 font-medium">Insumos Agotados (0)</p>
          <p className="text-2xl font-bold text-red-400 mt-1">
            {stockList.filter((s) => s.cantidad === 0).length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Sin saldo en farmacia</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400 font-medium">Valor Total Inventario</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{fmtCOP(valorTotalInventario)}</p>
          <p className="text-xs text-slate-500 mt-1">A costo promedio</p>
        </div>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, nombre o categoría..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setFilterType('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterType === 'todos'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos ({stockList.length})
          </button>
          <button
            onClick={() => setFilterType('con_stock')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterType === 'con_stock'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Con Saldo ({conStock})
          </button>
          <button
            onClick={() => setFilterType('bajo_stock')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterType === 'bajo_stock'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Stock Bajo ({alertasBajoStock})
          </button>
        </div>
      </div>

      {/* Tabla de Stock */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Código</th>
                <th className="px-4 py-3.5">Insumo / Material</th>
                <th className="px-4 py-3.5">Categoría</th>
                <th className="px-4 py-3.5">Unidad</th>
                <th className="px-4 py-3.5 text-right">Saldo Actual</th>
                <th className="px-4 py-3.5 text-right">Mín / Máx</th>
                <th className="px-4 py-3.5 text-right">Costo Promedio</th>
                <th className="px-4 py-3.5 text-right">Total Valorizado</th>
                <th className="px-4 py-3.5 text-center">Estado</th>
                {userCanManage && <th className="px-4 py-3.5 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredStock.map((row) => {
                const isZero = row.cantidad === 0
                const isLow = row.cantidad <= row.stock_minimo && !isZero
                return (
                  <tr key={row.material_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-sky-400">{row.codigo}</td>
                    <td className="px-4 py-3 font-medium text-white">{row.nombre}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{row.categoria}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{row.unidad}</td>
                    <td className="px-4 py-3 text-right font-bold text-base">
                      <span
                        className={
                          isZero
                            ? 'text-red-400'
                            : isLow
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }
                      >
                        {row.cantidad}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400 font-mono">
                      {row.stock_minimo} / {row.stock_maximo ?? '∞'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-300 font-mono">
                      {fmtCOP(row.costo_promedio)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-slate-200 font-mono">
                      {fmtCOP(row.cantidad * row.costo_promedio)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isZero ? (
                        <span className="px-2 py-0.5 text-xs rounded bg-red-500/10 text-red-400 border border-red-500/20">
                          Agotado
                        </span>
                      ) : isLow ? (
                        <span className="px-2 py-0.5 text-xs rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Stock Bajo
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          OK
                        </span>
                      )}
                    </td>
                    {userCanManage && (
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setErrorModal(null)
                            setModalAjuste(row)
                          }}
                          className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                          title="Ajustar saldo real por inventario físico"
                        >
                          ⚖️ Ajuste
                        </button>
                        <button
                          onClick={() => {
                            setErrorModal(null)
                            setModalConfig(row)
                          }}
                          className="text-xs px-2 py-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                          title="Configurar stock mínimo y máximo"
                        >
                          ⚙️
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}

              {filteredStock.length === 0 && (
                <tr>
                  <td colSpan={userCanManage ? 10 : 9} className="px-4 py-12 text-center text-slate-500">
                    No se encontraron insumos con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL REGISTRAR ENTRADA / COMPRA */}
      {modalEntrada && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Registrar Entrada / Compra de Insumos</h3>
                <p className="text-xs text-emerald-400 font-mono mt-0.5">
                  Destino: {currentFarmacia?.codigo} — {currentFarmacia?.nombre}
                </p>
              </div>
              <button onClick={() => setModalEntrada(false)} className="text-slate-500 hover:text-white p-1">
                ✕
              </button>
            </div>

            {errorModal && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
                {errorModal}
              </div>
            )}

            <form onSubmit={handleEntradaSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Proveedor (Opcional)
                  </label>
                  <input
                    type="text"
                    value={entradaProveedor}
                    onChange={(e) => setEntradaProveedor(e.target.value)}
                    placeholder="Ej: Depósito Dental S.A."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Factura / Remisión / Documento
                  </label>
                  <input
                    type="text"
                    value={entradaDoc}
                    onChange={(e) => setEntradaDoc(e.target.value)}
                    placeholder="Ej: FAC-98234"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-300">
                    Insumos a Ingresar <span className="text-red-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setEntradaItems([
                        ...entradaItems,
                        { material_id: '', cantidad: 1, costo_unitario: 0 },
                      ])
                    }
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                  >
                    + Agregar otra fila
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {entradaItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-center bg-slate-950/60 p-2.5 rounded-xl border border-slate-800"
                    >
                      <div className="col-span-6">
                        <InsumoSearchSelect
                          materials={allMaterials}
                          value={item.material_id}
                          onChange={(matId, found) => {
                            const updated = [...entradaItems]
                            updated[idx] = {
                              ...updated[idx],
                              material_id: matId,
                              costo_unitario: found?.precio_unitario || 0,
                            }
                            setEntradaItems(updated)
                          }}
                          placeholder="Buscar código o nombre..."
                        />
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.cantidad}
                          onChange={(e) => {
                            const updated = [...entradaItems]
                            updated[idx].cantidad = parseFloat(e.target.value) || 0
                            setEntradaItems(updated)
                          }}
                          placeholder="Cant."
                          required
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white text-right"
                        />
                      </div>

                      <div className="col-span-3">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={item.costo_unitario}
                          onChange={(e) => {
                            const updated = [...entradaItems]
                            updated[idx].costo_unitario = parseFloat(e.target.value) || 0
                            setEntradaItems(updated)
                          }}
                          placeholder="Costo unit."
                          required
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white text-right"
                        />
                      </div>

                      <div className="col-span-1 text-center">
                        {entradaItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setEntradaItems(entradaItems.filter((_, i) => i !== idx))
                            }
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Observaciones / Lote / Vencimiento
                </label>
                <textarea
                  value={entradaObs}
                  onChange={(e) => setEntradaObs(e.target.value)}
                  rows={2}
                  placeholder="Detalles adicionales del ingreso..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalEntrada(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-sm rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-lg shadow-emerald-600/20"
                >
                  {isPending ? 'Guardando...' : 'Confirmar Ingreso a Farmacia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AJUSTE FÍSICO */}
      {modalAjuste && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Ajuste de Stock Físico</h3>
                <p className="text-xs text-sky-400 font-mono">
                  {modalAjuste.codigo} — {modalAjuste.nombre}
                </p>
              </div>
              <button onClick={() => setModalAjuste(null)} className="text-slate-500 hover:text-white p-1">
                ✕
              </button>
            </div>

            {errorModal && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
                {errorModal}
              </div>
            )}

            <form onSubmit={handleAjusteSubmit} className="space-y-3">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 flex justify-between">
                <span>Saldo en Sistema:</span>
                <span className="font-bold text-white text-sm">{modalAjuste.cantidad} {modalAjuste.unidad}</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Cantidad Física Real Contada <span className="text-red-400">*</span>
                </label>
                <input
                  name="cantidad_real"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={modalAjuste.cantidad}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-base font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Motivo / Justificación del Ajuste <span className="text-red-400">*</span>
                </label>
                <textarea
                  name="motivo"
                  required
                  rows={3}
                  placeholder="Ej: Conteo físico mensual, merma justificada, rotura..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalAjuste(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-sm rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-lg shadow-sky-500/20"
                >
                  {isPending ? 'Ajustando...' : 'Aplicar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAR MÍNIMOS */}
      {modalConfig && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Configurar Umbrales de Stock</h3>
                <p className="text-xs text-sky-400 font-mono">
                  {modalConfig.codigo} — {modalConfig.nombre}
                </p>
              </div>
              <button onClick={() => setModalConfig(null)} className="text-slate-500 hover:text-white p-1">
                ✕
              </button>
            </div>

            {errorModal && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
                {errorModal}
              </div>
            )}

            <form onSubmit={handleConfigSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Stock Mínimo (Alerta de reabastecimiento)
                </label>
                <input
                  name="stock_minimo"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={modalConfig.stock_minimo}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Stock Máximo (Capacidad máxima opcional)
                </label>
                <input
                  name="stock_maximo"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={modalConfig.stock_maximo ?? ''}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalConfig(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-sm rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-lg shadow-emerald-600/20"
                >
                  {isPending ? 'Guardando...' : 'Guardar Umbrales'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TRASLADO ENTRE FARMACIAS */}
      {modalTraslado && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Trasladar Insumos Entre Farmacias</h3>
                <p className="text-xs text-sky-400 font-mono mt-0.5">
                  Origen: {currentFarmacia?.codigo} — {currentFarmacia?.nombre}
                </p>
              </div>
              <button onClick={() => setModalTraslado(false)} className="text-slate-500 hover:text-white p-1">
                ✕
              </button>
            </div>

            {errorModal && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
                {errorModal}
              </div>
            )}

            <form onSubmit={handleTrasladoSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Farmacia / Bodega Destino <span className="text-red-400">*</span>
                </label>
                <select
                  value={trasladoDestino}
                  onChange={(e) => setTrasladoDestino(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                >
                  <option value="">-- Seleccionar Destino --</option>
                  {farmacias
                    .filter((f) => f.id !== selectedFarmaciaId)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.codigo} — {f.nombre}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-300">
                    Insumos a Trasladar <span className="text-red-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setTrasladoItems([...trasladoItems, { material_id: '', cantidad: 1 }])
                    }
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                  >
                    + Agregar insumo
                  </button>
                </div>

                <div className="space-y-2">
                  {trasladoItems.map((item, idx) => {
                    const currentStock = stockList.find((s) => s.material_id === item.material_id)
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-center bg-slate-950/60 p-2.5 rounded-xl border border-slate-800"
                      >
                        <div className="col-span-8">
                          <select
                            value={item.material_id}
                            onChange={(e) => {
                              const updated = [...trasladoItems]
                              updated[idx].material_id = e.target.value
                              setTrasladoItems(updated)
                            }}
                            required
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                          >
                            <option value="">-- Seleccionar Insumo --</option>
                            {stockList
                              .filter((s) => s.cantidad > 0)
                              .map((s) => (
                                <option key={s.material_id} value={s.material_id}>
                                  {s.codigo} — {s.nombre} (Disp: {s.cantidad} {s.unidad})
                                </option>
                              ))}
                          </select>
                        </div>

                        <div className="col-span-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={currentStock?.cantidad || 999999}
                            value={item.cantidad}
                            onChange={(e) => {
                              const updated = [...trasladoItems]
                              updated[idx].cantidad = parseFloat(e.target.value) || 0
                              setTrasladoItems(updated)
                            }}
                            placeholder="Cant."
                            required
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white text-right"
                          />
                        </div>

                        <div className="col-span-1 text-center">
                          {trasladoItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setTrasladoItems(trasladoItems.filter((_, i) => i !== idx))
                              }
                              className="text-red-400 hover:text-red-300 text-sm"
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

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Observaciones del Traslado
                </label>
                <textarea
                  value={trasladoObs}
                  onChange={(e) => setTrasladoObs(e.target.value)}
                  rows={2}
                  placeholder="Motivo del traslado entre sedes..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalTraslado(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-sm rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-lg shadow-sky-500/20"
                >
                  {isPending ? 'Trasladando...' : 'Confirmar Traslado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
