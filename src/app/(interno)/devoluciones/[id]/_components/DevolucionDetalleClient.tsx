'use client'
// src/app/(interno)/devoluciones/[id]/_components/DevolucionDetalleClient.tsx
import { useState, useTransition } from 'react'
import type { Devolucion } from '@/types/database'
import { confirmarDevolucionAction, rechazarDevolucionAction } from '../../actions'

interface Props {
  devolucion: Devolucion
  userCanManageFarmacia: boolean
}

export default function DevolucionDetalleClient({
  devolucion,
  userCanManageFarmacia,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [modalConfirmar, setModalConfirmar] = useState(false)
  const [modalRechazar, setModalRechazar] = useState(false)
  const [errorModal, setErrorModal] = useState<string | null>(null)

  const [confirmItems, setConfirmItems] = useState(
    (devolucion.items || []).map((i) => ({
      item_id: i.id,
      nombre: i.material?.nombre || 'Insumo',
      unidad: i.material?.unidad_medida?.abreviatura || 'Und',
      cantidadDevuelta: i.cantidad,
      cantidadAceptada: i.cantidad,
    }))
  )
  const [obsConfirmacion, setObsConfirmacion] = useState('')
  const [motivoRechazo, setMotivoRechazo] = useState('')

  async function handleConfirmarSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorModal(null)
    const payload = confirmItems.map((i) => ({
      item_id: i.item_id,
      cantidad: i.cantidadAceptada,
    }))

    const hayDiferencia = confirmItems.some((i) => i.cantidadAceptada < i.cantidadDevuelta)
    if (hayDiferencia && !obsConfirmacion.trim()) {
      setErrorModal('Indica en observaciones por qué no se acepta la cantidad completa devuelta.')
      return
    }

    startTransition(async () => {
      const res = await confirmarDevolucionAction(devolucion.id, payload, obsConfirmacion)
      if (!res.success) {
        setErrorModal(res.error || 'Error al confirmar devolución')
      } else {
        setModalConfirmar(false)
        window.location.reload()
      }
    })
  }

  async function handleRechazarSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorModal(null)
    if (!motivoRechazo.trim()) {
      setErrorModal('El motivo del rechazo es obligatorio')
      return
    }

    startTransition(async () => {
      const res = await rechazarDevolucionAction(devolucion.id, motivoRechazo)
      if (!res.success) {
        setErrorModal(res.error || 'Error al rechazar')
      } else {
        setModalRechazar(false)
        window.location.reload()
      }
    })
  }

  if (devolucion.estado !== 'pendiente' || !userCanManageFarmacia) {
    return null
  }

  return (
    <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-bold text-amber-400">Acción Requerida en Farmacia:</p>
        <p className="text-xs text-slate-400">
          Esta devolución está esperando que el personal de farmacia reciba físicamente el producto e ingrese el saldo al inventario.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setErrorModal(null)
            setModalConfirmar(true)
          }}
          disabled={isPending}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
        >
          ✓ Confirmar Reingreso a Farmacia
        </button>
        <button
          onClick={() => {
            setErrorModal(null)
            setModalRechazar(true)
          }}
          disabled={isPending}
          className="px-3.5 py-2 bg-slate-800 hover:bg-red-500/20 text-red-400 text-xs rounded-xl border border-red-500/20 transition-colors"
        >
          Rechazar Devolución
        </button>
      </div>

      {/* Modal Confirmar */}
      {modalConfirmar && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Confirmar Entrada por Devolución</h3>
              <button onClick={() => setModalConfirmar(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>

            {errorModal && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
                {errorModal}
              </div>
            )}

            <form onSubmit={handleConfirmarSubmit} className="space-y-3">
              <p className="text-xs text-slate-400">
                Al confirmar, las cantidades aceptadas se sumarán inmediatamente al stock de la farmacia y se registrará la entrada en el Kardex.
              </p>

              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {confirmItems.map((item, idx) => (
                  <div key={item.item_id} className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <p className="font-medium text-white">{item.nombre}</p>
                      <p className="text-slate-500">Devuelto por área: {item.cantidadDevuelta} {item.unidad}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Aceptar:</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={item.cantidadDevuelta}
                        value={item.cantidadAceptada}
                        onChange={(e) => {
                          const updated = [...confirmItems]
                          updated[idx].cantidadAceptada = parseFloat(e.target.value) || 0
                          setConfirmItems(updated)
                        }}
                        className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white text-right font-bold text-emerald-400"
                      />
                      <span className="text-slate-400">{item.unidad}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Observaciones de Recepción en Farmacia
                </label>
                <textarea
                  value={obsConfirmacion}
                  onChange={(e) => setObsConfirmacion(e.target.value)}
                  rows={2}
                  placeholder="Estado del empaque, lote, etc."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setModalConfirmar(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20">
                  {isPending ? 'Ingresando...' : 'Confirmar Reingreso al Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Rechazar */}
      {modalRechazar && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Rechazar Devolución</h3>
            {errorModal && <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">{errorModal}</div>}
            <form onSubmit={handleRechazarSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Motivo del Rechazo <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  rows={3}
                  required
                  placeholder="Por qué no se acepta el reingreso de estos productos..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setModalRechazar(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">Cancelar</button>
                <button type="submit" disabled={isPending} className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl">Rechazar Definitivamente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
