'use client'
// src/app/(externo)/ordenes/[id]/_components/LabEstadoActions.tsx
import { useState, useTransition } from 'react'
import { cambiarEstadoOrdenAction } from '@/app/(interno)/ordenes/actions'
import { ORDEN_ESTADO_LABELS, type OrdenEstado } from '@/types/database'

// Lab can only do these transitions
const LAB_TRANSITIONS: Partial<Record<OrdenEstado, OrdenEstado[]>> = {
  enviada: ['recibida_lab'],
  recibida_lab: ['en_proceso'],
  en_proceso: ['lista'],
}

const ACTION_LABELS: Partial<Record<OrdenEstado, string>> = {
  recibida_lab: '✅ Confirmar Recepción',
  en_proceso: '⚙️ Marcar En Proceso',
  lista: '🎉 Marcar como Lista',
}

export default function LabEstadoActions({
  ordenId,
  estadoActual,
  userId,
  userNombre,
}: {
  ordenId: string
  estadoActual: OrdenEstado
  userId: string
  userNombre: string
}) {
  const [isPending, startTransition] = useTransition()
  const [observaciones, setObservaciones] = useState('')
  const [fechaEstimada, setFechaEstimada] = useState('')
  const [confirming, setConfirming] = useState<OrdenEstado | null>(null)

  const nextStates = LAB_TRANSITIONS[estadoActual] ?? []

  if (nextStates.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-center text-slate-500 text-sm">
        {estadoActual === 'lista'
          ? '✅ Marcaste esta orden como lista. El centro lo recogerá pronto.'
          : 'Sin acciones disponibles para este estado.'}
      </div>
    )
  }

  function doTransition(nuevoEstado: OrdenEstado) {
    if (!confirming) {
      setConfirming(nuevoEstado)
      return
    }
    startTransition(async () => {
      await cambiarEstadoOrdenAction(
        ordenId,
        nuevoEstado,
        observaciones || `${userNombre} confirmó: ${ORDEN_ESTADO_LABELS[nuevoEstado]}`,
        'portal_externo',
        nuevoEstado === 'recibida_lab' ? fechaEstimada : undefined
      )
    })
  }

  return (
    <div className="bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20 rounded-2xl p-5 space-y-4">
      <h2 className="font-semibold text-white text-sm">Acciones Disponibles</h2>

      {!confirming ? (
        <div className="flex flex-col gap-2">
          {nextStates.map((s) => (
            <button
              key={s}
              id={`btn-lab-${s}`}
              onClick={() => doTransition(s)}
              className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              {ACTION_LABELS[s] ?? ORDEN_ESTADO_LABELS[s]}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">
            Confirmar: <strong className="text-violet-400">{ORDEN_ESTADO_LABELS[confirming]}</strong>
          </p>

          {confirming === 'recibida_lab' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fecha estimada de entrega (recomendado)</label>
              <input
                type="date"
                value={fechaEstimada}
                onChange={(e) => setFechaEstimada(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1">Observaciones (opcional)</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              placeholder="Agrega notas si es necesario..."
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="flex-1 py-2.5 border border-slate-700 text-slate-400 hover:text-white rounded-xl text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              id="btn-confirmar-lab-accion"
              type="button"
              onClick={() => doTransition(confirming)}
              disabled={isPending}
              className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-60"
            >
              {isPending ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
