'use client'
// src/app/(interno)/farmacia/stock/_components/ModalActasRecepcion.tsx
import { useState } from 'react'
import {
  DICTAMEN_TECNICO_LABELS,
  TIPO_DOC_RECEPCION_LABELS,
  type RecepcionFarmacia,
} from '@/types/farmacia'
import { obtenerDetalleRecepcionAction } from '../actions'
import { generarActaRecepcionPDF } from '@/lib/farmacia-pdf'

interface Props {
  farmaciaNombre: string
  recepciones: RecepcionFarmacia[]
  onClose: () => void
}

function fmtCOP(v: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(v || 0)
}

function fmtDateTime(d: string) {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ModalActasRecepcion({ farmaciaNombre, recepciones, onClose }: Props) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = recepciones.filter((r) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.radicado.toLowerCase().includes(q) ||
      (r.proveedor_nombre || '').toLowerCase().includes(q) ||
      (r.proveedor_nit || '').toLowerCase().includes(q) ||
      (r.numero_documento || '').toLowerCase().includes(q)
    )
  })

  async function handleDownload(recId: string) {
    setDownloadingId(recId)
    const res = await obtenerDetalleRecepcionAction(recId)
    setDownloadingId(null)
    if (!res.success || !res.data) {
      alert(res.error || 'No se pudo cargar el detalle del acta')
      return
    }
    generarActaRecepcionPDF(res.data)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>📋</span>
              <span>Actas de Recepción Técnica y Compras</span>
            </h3>
            <p className="text-xs text-emerald-400 font-mono mt-0.5">{farmaciaNombre}</p>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por radicado REC, proveedor, NIT o factura..."
              className="w-full sm:max-w-md px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
            <span className="text-xs text-slate-400">{filtered.length} acta(s) registrada(s)</span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center bg-slate-950/60 border border-slate-800 rounded-xl text-slate-500 text-sm">
              No hay actas de recepción técnica registradas todavía.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[11px] uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-3.5 py-2.5">Radicado</th>
                    <th className="px-3.5 py-2.5">Fecha Recepción</th>
                    <th className="px-3.5 py-2.5">Proveedor / NIT</th>
                    <th className="px-3.5 py-2.5">Documento</th>
                    <th className="px-3.5 py-2.5">Condiciones</th>
                    <th className="px-3.5 py-2.5 text-center">Dictamen</th>
                    <th className="px-3.5 py-2.5 text-right">Total</th>
                    <th className="px-3.5 py-2.5 text-right">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/30">
                      <td className="px-3.5 py-3 font-mono font-bold text-sky-400 whitespace-nowrap">
                        {r.radicado}
                      </td>
                      <td className="px-3.5 py-3 text-slate-400 whitespace-nowrap font-mono">
                        {fmtDateTime(r.fecha_recepcion)}
                      </td>
                      <td className="px-3.5 py-3">
                        <p className="text-white font-medium">{r.proveedor_nombre || 'Sin proveedor'}</p>
                        {r.proveedor_nit && (
                          <p className="text-[10px] font-mono text-slate-500">NIT: {r.proveedor_nit}</p>
                        )}
                      </td>
                      <td className="px-3.5 py-3">
                        <p className="text-slate-200 font-mono">{r.numero_documento || '—'}</p>
                        <p className="text-[10px] text-slate-500">
                          {TIPO_DOC_RECEPCION_LABELS[r.tipo_documento] || r.tipo_documento}
                        </p>
                      </td>
                      <td className="px-3.5 py-3 text-[11px] text-slate-400 whitespace-nowrap">
                        {r.temperatura_recepcion != null ? `${r.temperatura_recepcion}°C` : '—'}
                        {r.humedad_recepcion != null ? ` · ${r.humedad_recepcion}%` : ''}
                        <span className="block text-[10px] text-slate-500">
                          Empaque: {r.condiciones_empaque_ok ? 'OK' : 'Novedad'}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-semibold ${
                            r.dictamen_tecnico === 'rechazado'
                              ? 'bg-red-500/10 text-red-400 border-red-500/30'
                              : r.dictamen_tecnico === 'cuarentena'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {DICTAMEN_TECNICO_LABELS[r.dictamen_tecnico]?.split(' ')[0] || r.dictamen_tecnico}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono font-semibold text-emerald-400 whitespace-nowrap">
                        {fmtCOP(r.valor_total)}
                      </td>
                      <td className="px-3.5 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDownload(r.id)}
                          disabled={downloadingId === r.id}
                          className="px-2.5 py-1 bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 rounded-lg text-[11px] font-semibold disabled:opacity-50"
                        >
                          {downloadingId === r.id ? '...' : '📄 PDF'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
