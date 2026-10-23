'use client'
// src/app/(interno)/solicitudes/[id]/_components/SolicitudDetalleClient.tsx
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Solicitud, SolicitudItem, SolicitudEstado } from '@/types/database'
import {
  enviarSolicitudAction,
  aprobarSolicitudAction,
  rechazarSolicitudAction,
  despacharSolicitudAction,
  recibirSolicitudAction,
  cerrarSolicitudAction,
  anularSolicitudAction,
} from '../../actions'
import { crearDevolucionAction } from '@/app/(interno)/devoluciones/actions'

interface Props {
  solicitud: Solicitud
  currentUserId: string
  currentUserRole: string
  userCanApproveOrDispatch: boolean
  userCanReceiveOrReturn: boolean
  stockFarmaciaMap: Record<string, number> // material_id -> cantidad disponible en farmacia
}

function fmtCOP(v: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(v || 0)
}

export default function SolicitudDetalleClient({
  solicitud,
  currentUserId,
  currentUserRole,
  userCanApproveOrDispatch,
  userCanReceiveOrReturn,
  stockFarmaciaMap,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorModal, setErrorModal] = useState<string | null>(null)

  // Modales
  const [modalAprobar, setModalAprobar] = useState(false)
  const [modalRechazar, setModalRechazar] = useState(false)
  const [modalDespachar, setModalDespachar] = useState(false)
  const [modalRecibir, setModalRecibir] = useState(false)
  const [modalDevolver, setModalDevolver] = useState(false)
  const [modalAnular, setModalAnular] = useState(false)

  // Estados de formularios dentro de modales
  const [aprobacionItems, setAprobacionItems] = useState(
    (solicitud.items || []).map((i) => ({
      item_id: i.id,
      nombre: i.material?.nombre || 'Insumo',
      unidad: i.material?.unidad_medida?.abreviatura || 'Und',
      solicitada: i.cantidad_solicitada,
      aprobada: i.cantidad_aprobada ?? i.cantidad_solicitada,
    }))
  )
  const [comentarioAprobacion, setComentarioAprobacion] = useState('')

  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [motivoAnulacion, setMotivoAnulacion] = useState('')

  // Despacho
  const [despachoItems, setDespachoItems] = useState(
    (solicitud.items || []).map((i) => {
      const maxPendiente = (i.cantidad_aprobada ?? i.cantidad_solicitada) - i.cantidad_despachada
      const available = stockFarmaciaMap[i.material_id] ?? 0
      return {
        item_id: i.id,
        material_id: i.material_id,
        nombre: i.material?.nombre || 'Insumo',
        codigo: i.material?.codigo || '',
        unidad: i.material?.unidad_medida?.abreviatura || 'Und',
        pendiente: Math.max(0, maxPendiente),
        disponibleStock: available,
        aDespachar: Math.min(Math.max(0, maxPendiente), available),
      }
    })
  )
  const [comentarioDespacho, setComentarioDespacho] = useState('')

  // Recepción
  const [recepcionItems, setRecepcionItems] = useState(
    (solicitud.items || []).map((i) => ({
      item_id: i.id,
      nombre: i.material?.nombre || 'Insumo',
      unidad: i.material?.unidad_medida?.abreviatura || 'Und',
      despachada: i.cantidad_despachada,
      recibida: i.cantidad_despachada, // por defecto completo
    }))
  )
  const [obsRecepcion, setObsRecepcion] = useState('')

  // Devolución
  const [motivoDevolucion, setMotivoDevolucion] = useState<'no_utilizado' | 'vencido' | 'defectuoso' | 'error_despacho' | 'otro'>('no_utilizado')
  const [detalleDevolucion, setDetalleDevolucion] = useState('')
  const [devolucionItems, setDevolucionItems] = useState(
    (solicitud.items || []).map((i) => {
      const disponible = i.cantidad_recibida - i.cantidad_devuelta
      return {
        item_id: i.id,
        nombre: i.material?.nombre || 'Insumo',
        unidad: i.material?.unidad_medida?.abreviatura || 'Und',
        disponibleDevolucion: Math.max(0, disponible),
        aDevolver: 0,
      }
    })
  )

  // Acciones
  async function handleEnviar() {
    if (!confirm('¿Deseas enviar esta solicitud a farmacia?')) return
    startTransition(async () => {
      const res = await enviarSolicitudAction(solicitud.id)
      if (!res.success) alert(res.error)
      else window.location.reload()
    })
  }

  async function handleAprobarSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorModal(null)
    const payload = aprobacionItems.map((i) => ({
      item_id: i.item_id,
      cantidad: i.aprobada,
    }))

    startTransition(async () => {
      const res = await aprobarSolicitudAction(solicitud.id, payload, comentarioAprobacion)
      if (!res.success) {
        setErrorModal(res.error || 'Error al aprobar')
      } else {
        setModalAprobar(false)
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
      const res = await rechazarSolicitudAction(solicitud.id, motivoRechazo)
      if (!res.success) {
        setErrorModal(res.error || 'Error al rechazar')
      } else {
        setModalRechazar(false)
        window.location.reload()
      }
    })
  }

  async function handleDespacharSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorModal(null)
    const validItems = despachoItems
      .filter((i) => i.aDespachar > 0)
      .map((i) => ({
        item_id: i.item_id,
        cantidad: i.aDespachar,
      }))

    if (validItems.length === 0) {
      setErrorModal('Debes despachar al menos un insumo con cantidad mayor a cero')
      return
    }

    startTransition(async () => {
      const res = await despacharSolicitudAction(solicitud.id, validItems, comentarioDespacho)
      if (!res.success) {
        setErrorModal(res.error || 'Error al despachar')
      } else {
        setModalDespachar(false)
        window.location.reload()
      }
    })
  }

  async function handleRecibirSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorModal(null)
    const payload = recepcionItems.map((i) => ({
      item_id: i.item_id,
      cantidad: i.recibida,
    }))

    const hayDiferencia = recepcionItems.some((i) => i.recibida < i.despachada)
    if (hayDiferencia && !obsRecepcion.trim()) {
      setErrorModal('Hay diferencias con lo despachado. Especifica la novedad en observaciones.')
      return
    }

    startTransition(async () => {
      const res = await recibirSolicitudAction(solicitud.id, payload, obsRecepcion)
      if (!res.success) {
        setErrorModal(res.error || 'Error al confirmar recepción')
      } else {
        setModalRecibir(false)
        window.location.reload()
      }
    })
  }

  async function handleDevolverSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorModal(null)
    const validItems = devolucionItems
      .filter((i) => i.aDevolver > 0)
      .map((i) => ({
        item_id: i.item_id,
        cantidad: i.aDevolver,
      }))

    if (validItems.length === 0) {
      setErrorModal('Debes indicar al menos un insumo a devolver con cantidad mayor a cero')
      return
    }

    startTransition(async () => {
      const res = await crearDevolucionAction(
        solicitud.id,
        motivoDevolucion,
        detalleDevolucion,
        validItems
      )
      if (!res.success) {
        setErrorModal(res.error || 'Error al registrar devolución')
      } else {
        alert(`Devolución generada exitosamente. Radicado: ${res.data.radicado}`)
        setModalDevolver(false)
        router.push(`/devoluciones/${res.data.id}`)
      }
    })
  }

  async function handleCerrar() {
    if (!confirm('¿Deseas cerrar definitivamente esta solicitud? No se podrán realizar más despachos ni devoluciones.')) return
    startTransition(async () => {
      const res = await cerrarSolicitudAction(solicitud.id)
      if (!res.success) alert(res.error)
      else window.location.reload()
    })
  }

  async function handleAnularSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorModal(null)
    if (!motivoAnulacion.trim()) {
      setErrorModal('El motivo de la anulación es obligatorio')
      return
    }

    startTransition(async () => {
      const res = await anularSolicitudAction(solicitud.id, motivoAnulacion)
      if (!res.success) {
        setErrorModal(res.error || 'Error al anular')
      } else {
        setModalAnular(false)
        window.location.reload()
      }
    })
  }

  // Permisos de botones según estado
  const canSend = solicitud.estado === 'borrador' && userCanReceiveOrReturn
  const canApprove = solicitud.estado === 'enviada' && userCanApproveOrDispatch
  const canDispatch =
    (solicitud.estado === 'aprobada' ||
      solicitud.estado === 'despachada_parcial' ||
      solicitud.estado === 'enviada') &&
    userCanApproveOrDispatch
  const canReject =
    (solicitud.estado === 'enviada' || solicitud.estado === 'aprobada') &&
    userCanApproveOrDispatch &&
    solicitud.valor_despachado === 0
  const canReceive =
    (solicitud.estado === 'despachada' || solicitud.estado === 'despachada_parcial') &&
    userCanReceiveOrReturn
  const canReturn =
    solicitud.estado === 'recibida' &&
    userCanReceiveOrReturn &&
    (solicitud.items || []).some((i) => i.cantidad_recibida > i.cantidad_devuelta)
  const canClose = solicitud.estado === 'recibida' && (userCanReceiveOrReturn || userCanApproveOrDispatch)
  const canCancel =
    (solicitud.estado === 'borrador' || solicitud.estado === 'enviada' || solicitud.estado === 'aprobada') &&
    solicitud.valor_despachado === 0 &&
    (userCanReceiveOrReturn || userCanApproveOrDispatch)

  return (
    <div className="space-y-4">
      {/* Barra de Acciones según Estado y Rol */}
      <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 sticky top-2 z-20 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Acciones Disponibles:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botón Enviar */}
          {canSend && (
            <button
              onClick={handleEnviar}
              disabled={isPending}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 transition-all"
            >
              🚀 Enviar a Farmacia
            </button>
          )}

          {/* Botones de Farmacia: Aprobar y Despachar */}
          {canApprove && (
            <button
              onClick={() => {
                setErrorModal(null)
                setModalAprobar(true)
              }}
              disabled={isPending}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs rounded-xl transition-all"
            >
              ✓ Aprobar Cantidades
            </button>
          )}

          {canDispatch && (
            <button
              onClick={() => {
                setErrorModal(null)
                setModalDespachar(true)
              }}
              disabled={isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5"
            >
              <span>📦</span>
              <span>Despachar Insumos</span>
            </button>
          )}

          {canReject && (
            <button
              onClick={() => {
                setErrorModal(null)
                setModalRechazar(true)
              }}
              disabled={isPending}
              className="px-3 py-2 bg-slate-800 hover:bg-red-500/20 text-red-400 font-medium text-xs rounded-xl border border-red-500/20 transition-colors"
            >
              Rechazar Pedido
            </button>
          )}

          {/* Botón Confirmar Recepción (Área) */}
          {canReceive && (
            <button
              onClick={() => {
                setErrorModal(null)
                setModalRecibir(true)
              }}
              disabled={isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
            >
              📥 Confirmar Recepción en Área
            </button>
          )}

          {/* Botón Devolución */}
          {canReturn && (
            <button
              onClick={() => {
                setErrorModal(null)
                setModalDevolver(true)
              }}
              disabled={isPending}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-amber-600/20 transition-all flex items-center gap-1.5"
            >
              <span>↩️</span>
              <span>Devolver Insumos</span>
            </button>
          )}

          {/* Botón Cerrar */}
          {canClose && (
            <button
              onClick={handleCerrar}
              disabled={isPending}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition-colors"
            >
              🔒 Cerrar Solicitud
            </button>
          )}

          {/* Botón Anular */}
          {canCancel && (
            <button
              onClick={() => {
                setErrorModal(null)
                setModalAnular(true)
              }}
              disabled={isPending}
              className="px-3 py-2 text-red-400 hover:text-red-300 text-xs rounded-xl hover:bg-red-500/10 transition-colors"
            >
              Anular
            </button>
          )}

          {/* Duplicar pedido (para periódicos) */}
          <button
            onClick={() => router.push(`/solicitudes/nueva?duplicar=${solicitud.id}`)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 text-xs font-medium rounded-xl border border-slate-700 transition-colors"
            title="Crear una nueva solicitud con estos mismos insumos y área"
          >
            📋 Duplicar Pedido
          </button>
        </div>
      </div>

      {/* MODAL APROBAR SOLICITUD */}
      {modalAprobar && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Aprobar Pedido y Ajustar Cantidades</h3>
              <button onClick={() => setModalAprobar(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>

            {errorModal && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
                {errorModal}
              </div>
            )}

            <form onSubmit={handleAprobarSubmit} className="space-y-3">
              <p className="text-xs text-slate-400">
                Puedes ajustar la cantidad autorizada a despachar si no se cuenta con suficiente stock o por criterios técnicos.
              </p>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {aprobacionItems.map((item, idx) => (
                  <div key={item.item_id} className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <p className="font-medium text-white">{item.nombre}</p>
                      <p className="text-slate-500">Solicitado: {item.solicitada} {item.unidad}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Aprobar:</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.aprobada}
                        onChange={(e) => {
                          const updated = [...aprobacionItems]
                          updated[idx].aprobada = parseFloat(e.target.value) || 0
                          setAprobacionItems(updated)
                        }}
                        className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white text-right font-bold"
                      />
                      <span className="text-slate-400">{item.unidad}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Comentario para el Área</label>
                <textarea
                  value={comentarioAprobacion}
                  onChange={(e) => setComentarioAprobacion(e.target.value)}
                  rows={2}
                  placeholder="Nota u observaciones de farmacia..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setModalAprobar(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending} className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-500/20">
                  {isPending ? 'Procesando...' : 'Confirmar Aprobación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DESPACHAR */}
      {modalDespachar && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Despachar Insumos a {solicitud.area?.nombre}</h3>
                <p className="text-xs text-emerald-400 font-mono mt-0.5">
                  Radicado: {solicitud.radicado}
                </p>
              </div>
              <button onClick={() => setModalDespachar(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>

            {errorModal && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
                {errorModal}
              </div>
            )}

            <form onSubmit={handleDespacharSubmit} className="space-y-3">
              <p className="text-xs text-slate-400">
                Indica las cantidades físicas que salen de la farmacia para entrega al área. Se descontará automáticamente del stock.
              </p>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {despachoItems.map((item, idx) => (
                  <div key={item.item_id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-sky-400 mr-2">{item.codigo}</span>
                        <span className="font-medium text-white">{item.nombre}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500">Pendiente: </span>
                        <span className="text-amber-400 font-bold">{item.pendiente} {item.unidad}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                      <span className={`text-[11px] ${item.disponibleStock > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        Stock Disponible en Farmacia: {item.disponibleStock} {item.unidad}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium">A Despachar:</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={Math.min(item.pendiente, item.disponibleStock)}
                          value={item.aDespachar}
                          onChange={(e) => {
                            const updated = [...despachoItems]
                            updated[idx].aDespachar = parseFloat(e.target.value) || 0
                            setDespachoItems(updated)
                          }}
                          className="w-24 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white text-right font-bold text-emerald-400"
                        />
                        <span className="text-slate-400">{item.unidad}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Observaciones del Despacho (Opcional)</label>
                <input
                  type="text"
                  value={comentarioDespacho}
                  onChange={(e) => setComentarioDespacho(e.target.value)}
                  placeholder="Ej: Se despacha con sello de seguridad #102..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setModalDespachar(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20">
                  {isPending ? 'Despachando...' : 'Confirmar Salida y Despacho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RECEPCIÓN (Área) */}
      {modalRecibir && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Confirmar Recepción de Insumos</h3>
              <button onClick={() => setModalRecibir(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>

            {errorModal && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
                {errorModal}
              </div>
            )}

            <form onSubmit={handleRecibirSubmit} className="space-y-3">
              <p className="text-xs text-slate-400">
                Verifica físicamente los insumos recibidos. Si algún producto llegó incompleto o dañado, ajusta la cantidad e indica la novedad.
              </p>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {recepcionItems.map((item, idx) => (
                  <div key={item.item_id} className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <p className="font-medium text-white">{item.nombre}</p>
                      <p className="text-slate-500">Despachado: {item.despachada} {item.unidad}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Recibido:</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={item.despachada}
                        value={item.recibida}
                        onChange={(e) => {
                          const updated = [...recepcionItems]
                          updated[idx].recibida = parseFloat(e.target.value) || 0
                          setRecepcionItems(updated)
                        }}
                        className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white text-right font-bold"
                      />
                      <span className="text-slate-400">{item.unidad}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Observaciones / Novedad (Obligatorio si falta algo)
                </label>
                <textarea
                  value={obsRecepcion}
                  onChange={(e) => setObsRecepcion(e.target.value)}
                  rows={2}
                  placeholder="Detalla cualquier faltante, daño o conformidad..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setModalRecibir(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20">
                  {isPending ? 'Confirmando...' : 'Confirmar Recepción'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DEVOLUCIÓN A FARMACIA */}
      {modalDevolver && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Devolver Insumos a Farmacia</h3>
              <button onClick={() => setModalDevolver(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>

            {errorModal && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
                {errorModal}
              </div>
            )}

            <form onSubmit={handleDevolverSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Motivo de la Devolución <span className="text-red-400">*</span>
                </label>
                <select
                  value={motivoDevolucion}
                  onChange={(e) => setMotivoDevolucion(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="no_utilizado">No utilizado en el área (Sobrante)</option>
                  <option value="vencido">Fecha próxima a vencer o vencido</option>
                  <option value="defectuoso">Producto dañado / defecto de fábrica</option>
                  <option value="error_despacho">Error en el despacho de farmacia</option>
                  <option value="otro">Otro motivo (especificar)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Detalle / Justificación
                </label>
                <textarea
                  value={detalleDevolucion}
                  onChange={(e) => setDetalleDevolucion(e.target.value)}
                  rows={2}
                  placeholder="Explica detalladamente por qué se reintegran estos insumos..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Cantidades a Devolver
                </label>
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {devolucionItems.map((item, idx) => (
                    <div key={item.item_id} className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                      <div>
                        <p className="font-medium text-white">{item.nombre}</p>
                        <p className="text-slate-500">Disponible p/ devolver: {item.disponibleDevolucion} {item.unidad}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Devolver:</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={item.disponibleDevolucion}
                          value={item.aDevolver}
                          onChange={(e) => {
                            const updated = [...devolucionItems]
                            updated[idx].aDevolver = parseFloat(e.target.value) || 0
                            setDevolucionItems(updated)
                          }}
                          className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white text-right font-bold text-amber-400"
                        />
                        <span className="text-slate-400">{item.unidad}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setModalDevolver(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending} className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-600/20">
                  {isPending ? 'Generando...' : 'Generar Devolución'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RECHAZAR */}
      {modalRechazar && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Rechazar Solicitud</h3>
            {errorModal && <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">{errorModal}</div>}
            <form onSubmit={handleRechazarSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Motivo del Rechazo <span className="text-red-400">*</span></label>
                <textarea
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  rows={3}
                  required
                  placeholder="Explica por qué no se puede atender este pedido..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setModalRechazar(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">Cancelar</button>
                <button type="submit" disabled={isPending} className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl">Confirmar Rechazo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ANULAR */}
      {modalAnular && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Anular Solicitud</h3>
            {errorModal && <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">{errorModal}</div>}
            <form onSubmit={handleAnularSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Motivo de Anulación <span className="text-red-400">*</span></label>
                <textarea
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  rows={3}
                  required
                  placeholder="Por qué se anula esta solicitud..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setModalAnular(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl">Cancelar</button>
                <button type="submit" disabled={isPending} className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl">Anular Definitivamente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
