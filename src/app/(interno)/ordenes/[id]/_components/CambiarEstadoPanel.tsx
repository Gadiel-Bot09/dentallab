'use client'
// src/app/(interno)/ordenes/[id]/_components/CambiarEstadoPanel.tsx
import { useState, useTransition } from 'react'
import { cambiarEstadoOrdenAction } from '../../actions'
import { ORDEN_ESTADO_LABELS, type OrdenEstado, type ModoGestion } from '@/types/database'

// Define valid transitions per state
const TRANSITIONS: Partial<Record<OrdenEstado, OrdenEstado[]>> = {
  borrador: ['enviada', 'cancelada'],
  enviada: ['recibida_lab', 'cancelada'],
  recibida_lab: ['en_proceso'],
  en_proceso: ['lista'],
  lista: ['enviada_centro'],
  enviada_centro: ['recibida_centro'],
  recibida_centro: ['entregada_paciente'],
}

// Lab can only do these
const LAB_TRANSITIONS: Partial<Record<OrdenEstado, OrdenEstado[]>> = {
  enviada: ['recibida_lab'],
  recibida_lab: ['en_proceso'],
  en_proceso: ['lista'],
}

export default function CambiarEstadoPanel({
  ordenId,
  estadoActual,
  userRol,
  modoGestionActual,
}: {
  ordenId: string
  estadoActual: OrdenEstado
  userRol: string
  modoGestionActual: ModoGestion
}) {
  const isLab = userRol === 'laboratorio'
  const transitionMap = isLab ? LAB_TRANSITIONS : TRANSITIONS
  const nextStates = transitionMap[estadoActual] ?? []
  const [isPending, startTransition] = useTransition()
  const [selectedState, setSelectedState] = useState<OrdenEstado | ''>('')
  const [observaciones, setObservaciones] = useState('')
  const [fechaEstimada, setFechaEstimada] = useState('')
  const [modo, setModo] = useState<ModoGestion>(isLab ? 'portal_externo' : 'gestion_interna')

  function handleTransition() {
    if (!selectedState) return
    startTransition(async () => {
      await cambiarEstadoOrdenAction(
        ordenId,
        selectedState as OrdenEstado,
        observaciones,
        modo,
        fechaEstimada || undefined
      )
    })
  }

  if (nextStates.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="font-semibold text-white mb-2 text-sm uppercase tracking-wider">Estado</h2>
        <p className="text-slate-500 text-sm">
          {estadoActual === 'cancelada' ? 'Orden cancelada.' : estadoActual === 'entregada_paciente' ? 'Ciclo completo.' : 'Sin transiciones disponibles.'}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <h2 className="font-semibold text-white text-sm uppercase tracking-wider">Cambiar Estado</h2>

      <div>
        <label className="block text-xs text-slate-500 mb-1.5">Nuevo estado</label>
        <select
          id="nuevo-estado-select"
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value as OrdenEstado | '')}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
        >
          <option value="">— Seleccionar —</option>
          {nextStates.map((s) => (
            <option key={s} value={s}>{ORDEN_ESTADO_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {selectedState === 'recibida_lab' && (
        <div>
          <label className="block text-xs text-slate-500 mb-1.5">Fecha estimada de entrega</label>
          <input
            type="date"
            value={fechaEstimada}
            onChange={(e) => setFechaEstimada(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
        </div>
      )}

      <div>
        <label className="block text-xs text-slate-500 mb-1.5">
          Observaciones {!isLab && '(si registras por el lab, es obligatorio justificar)'}
        </label>
        <textarea
          id="observaciones-estado"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={3}
          placeholder="Detalles de esta transición..."
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 resize-none"
        />
      </div>

      {/* Modo selector for auxiliar acting on behalf of lab */}
      {!isLab && (
        <div>
          <label className="block text-xs text-slate-500 mb-1.5">Modo de gestión</label>
          <select
            value={modo}
            onChange={(e) => setModo(e.target.value as ModoGestion)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          >
            <option value="gestion_interna">👤 Gestión interna (por auxiliar)</option>
            <option value="portal_externo">🔬 Registrando en nombre del laboratorio</option>
          </select>
        </div>
      )}

      <button
        id="btn-cambiar-estado"
        onClick={handleTransition}
        disabled={!selectedState || isPending}
        className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-sky-500/20 transition-all disabled:opacity-40"
      >
        {isPending ? 'Actualizando...' : 'Confirmar Cambio de Estado'}
      </button>
    </div>
  )
}
