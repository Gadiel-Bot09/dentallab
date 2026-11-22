'use client'
// src/app/(interno)/farmacia/stock/_components/ModalLotesInsumo.tsx
import { useEffect, useState, useTransition } from 'react'
import {
  CONDICION_ALMACENAMIENTO_LABELS,
  ESTADO_LOTE_COLORS,
  ESTADO_LOTE_LABELS,
  evaluarVencimiento,
  type EstadoLote,
  type LoteFarmacia,
} from '@/types/farmacia'
import { cambiarEstadoLoteAction, obtenerLotesMaterialAction } from '../actions'

interface Props {
  farmaciaId: string
  material: {
    material_id: string
    codigo: string
    nombre: string
    unidad: string
  }
  userCanManage: boolean
  onClose: () => void
  onChanged: () => void
}

function fmtCOP(v: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(v || 0)
}

function fmtDate(d: string | null) {
  if (!d) return 'Sin vencimiento'
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

export default function ModalLotesInsumo({
  farmaciaId,
  material,
  userCanManage,
  onClose,
  onChanged,
}: Props) {
  const [lotes, setLotes] = useState<LoteFarmacia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Mini acción para cambiar estado de un lote específico
  const [accionLote, setAccionLote] = useState<{
    lote: LoteFarmacia
    nuevoEstado: Extract<EstadoLote, 'disponible' | 'cuarentena' | 'vencido' | 'retirado'>
  } | null>(null)
  const [motivoCambio, setMotivoCambio] = useState('')

  async function loadLotes() {
    setLoading(true)
    setError(null)
    const res = await obtenerLotesMaterialAction(farmaciaId, material.material_id)
    setLoading(false)
    if (!res.success) {
      setError(res.error || 'Error cargando lotes')
    } else {
      setLotes(res.data || [])
    }
  }

  useEffect(() => {
    loadLotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmaciaId, material.material_id])

  function handleConfirmCambioEstado(e: React.FormEvent) {
    e.preventDefault()
    if (!accionLote) return
    setError(null)
    startTransition(async () => {
      const res = await cambiarEstadoLoteAction(
        accionLote.lote.id,
        accionLote.nuevoEstado,
        motivoCambio
      )
      if (!res.success) {
        setError(res.error || 'Error al actualizar estado del lote')
      } else {
        setAccionLote(null)
        setMotivoCambio('')
        await loadLotes()
        onChanged()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>📦</span>
              <span>Control de Lotes y Vencimientos (FEFO)</span>
            </h3>
            <p className="text-xs text-sky-400 font-mono mt-0.5">
              {material.codigo} — {material.nombre} ({material.unidad})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
              ⚠️ {error}
            </div>
          )}

          {/* Panel de confirmación de cambio de estado */}
          {accionLote && (
            <form
              onSubmit={handleConfirmCambioEstado}
              className="p-4 bg-amber-950/20 border border-amber-500/40 rounded-xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-amber-300">
                  Cambiar Lote <span className="font-mono">{accionLote.lote.numero_lote}</span> a{' '}
                  <span className="uppercase">{ESTADO_LOTE_LABELS[accionLote.nuevoEstado]}</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAccionLote(null)
                    setMotivoCambio('')
                  }}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
              </div>
              <p className="text-[11px] text-slate-300">
                {accionLote.nuevoEstado === 'disponible'
                  ? `Al liberar este lote de cuarentena, se sumarán +${accionLote.lote.cantidad_disponible} ${material.unidad} al stock disponible y se registrará en el Kardex.`
                  : `Al pasar este lote a ${ESTADO_LOTE_LABELS[accionLote.nuevoEstado]}, se descontarán ${accionLote.lote.cantidad_disponible} ${material.unidad} del stock disponible de farmacia con registro en Kardex.`}
              </p>
              <input
                type="text"
                required
                value={motivoCambio}
                onChange={(e) => setMotivoCambio(e.target.value)}
                placeholder="Motivo técnico / número de acta o concepto de dirección técnica *"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg"
                >
                  {isPending ? 'Aplicando...' : 'Confirmar Cambio de Estado'}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Cargando lotes...</div>
          ) : lotes.length === 0 ? (
            <div className="py-12 text-center bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <p className="text-3xl">🏷️</p>
              <p className="text-sm text-slate-300 font-medium">
                No hay lotes registrados para este insumo en esta farmacia
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Los lotes se crean automáticamente al registrar compras/entradas desde el botón &ldquo;Registrar Entrada / Compra&rdquo;.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-[11px] text-slate-400">
                Ordenados bajo regla <strong className="text-sky-400">FEFO</strong> (Primero en Vencer, Primero en Salir). Los despachos a áreas descuentan automáticamente en este orden.
              </p>
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-[11px] uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-3.5 py-2.5">Nº Lote / Barras</th>
                      <th className="px-3.5 py-2.5">Vencimiento</th>
                      <th className="px-3.5 py-2.5">INVIMA / Fabricante</th>
                      <th className="px-3.5 py-2.5">Proveedor / Almac.</th>
                      <th className="px-3.5 py-2.5 text-right">Disponible / Inicial</th>
                      <th className="px-3.5 py-2.5 text-right">Costo Unit.</th>
                      <th className="px-3.5 py-2.5 text-center">Estado</th>
                      {userCanManage && <th className="px-3.5 py-2.5 text-right">Gestión</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {lotes.map((l) => {
                      const vto = evaluarVencimiento(l.fecha_vencimiento)
                      return (
                        <tr key={l.id} className="hover:bg-slate-800/30">
                          <td className="px-3.5 py-3">
                            <p className="font-mono font-bold text-white">{l.numero_lote}</p>
                            {l.codigo_barras && (
                              <p className="text-[10px] font-mono text-slate-500">EAN: {l.codigo_barras}</p>
                            )}
                          </td>
                          <td className="px-3.5 py-3">
                            <p className="font-mono text-slate-200">{fmtDate(l.fecha_vencimiento)}</p>
                            <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${vto.badgeClass}`}>
                              {vto.label}
                            </span>
                          </td>
                          <td className="px-3.5 py-3">
                            <p className="text-emerald-300/90 font-medium">{l.registro_sanitario || '—'}</p>
                            <p className="text-[10px] text-slate-500">
                              {[l.laboratorio_fabricante, l.presentacion].filter(Boolean).join(' · ') || '—'}
                            </p>
                          </td>
                          <td className="px-3.5 py-3">
                            <p className="text-slate-300">{l.proveedor_nombre || '—'}</p>
                            <p className="text-[10px] text-slate-500">
                              {CONDICION_ALMACENAMIENTO_LABELS[l.condiciones_almacenamiento] || l.condiciones_almacenamiento}
                            </p>
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono">
                            <span className="font-bold text-white text-sm">{l.cantidad_disponible}</span>
                            <span className="text-slate-500"> / {l.cantidad_inicial}</span>
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono text-slate-300">
                            {fmtCOP(l.costo_unitario)}
                          </td>
                          <td className="px-3.5 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-semibold ${ESTADO_LOTE_COLORS[l.estado]}`}>
                              {ESTADO_LOTE_LABELS[l.estado]}
                            </span>
                          </td>
                          {userCanManage && (
                            <td className="px-3.5 py-3 text-right whitespace-nowrap space-x-1">
                              {l.estado === 'cuarentena' && l.cantidad_disponible > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setAccionLote({ lote: l, nuevoEstado: 'disponible' })}
                                  className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-semibold"
                                >
                                  Liberar
                                </button>
                              )}
                              {l.estado === 'disponible' && l.cantidad_disponible > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setAccionLote({ lote: l, nuevoEstado: 'cuarentena' })}
                                  className="px-2 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 rounded text-[10px] font-semibold"
                                >
                                  Cuarentena
                                </button>
                              )}
                              {(l.estado === 'disponible' || l.estado === 'cuarentena') && l.cantidad_disponible > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setAccionLote({ lote: l, nuevoEstado: 'retirado' })}
                                  className="px-2 py-1 bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-500/30 rounded text-[10px] font-semibold"
                                >
                                  Retirar
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-slate-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
