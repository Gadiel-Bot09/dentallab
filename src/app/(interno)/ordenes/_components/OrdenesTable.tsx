// src/app/(interno)/ordenes/_components/OrdenesTable.tsx
import Link from 'next/link'
import { ORDEN_ESTADO_LABELS, ORDEN_ESTADO_COLORS, type OrdenEstado } from '@/types/database'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Orden {
  id: string
  radicado: string
  tipo_trabajo: string
  estado: OrdenEstado
  fecha_estimada_entrega: string | null
  fecha_creacion: string
  precio_venta: number
  margen_ganancia: number
  pacientes?: { nombre: string; apellido: string } | null
  laboratorios?: { nombre: string } | null
  usuarios?: { nombre: string; apellido: string } | null
}

function isOverdue(orden: Orden): boolean {
  if (!orden.fecha_estimada_entrega) return false
  const notDone = !['entregada_paciente', 'cancelada', 'recibida_centro', 'enviada_centro'].includes(orden.estado)
  return notDone && new Date(orden.fecha_estimada_entrega) < new Date()
}

export default function OrdenesTable({ ordenes }: { ordenes: Orden[] }) {
  const formatCOP = (v: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)

  if (ordenes.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-16 text-center text-slate-500">
        <p className="text-4xl mb-3">📋</p>
        <p className="font-medium">No se encontraron órdenes</p>
        <p className="text-sm mt-1">Crea una nueva orden o ajusta los filtros</p>
        <Link href="/ordenes/nueva" className="inline-block mt-4 text-sky-400 hover:text-sky-300 text-sm transition-colors">
          + Crear primera orden →
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left">
              <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Radicado</th>
              <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Paciente</th>
              <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Trabajo</th>
              <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Laboratorio</th>
              <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">F. Entrega</th>
              <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Precio</th>
              <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Margen</th>
              <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Estado</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {ordenes.map((orden) => {
              const overdue = isOverdue(orden)
              return (
                <tr
                  key={orden.id}
                  className={`hover:bg-slate-800/30 transition-colors ${overdue ? 'bg-red-500/5' : ''}`}
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/ordenes/${orden.id}`}
                      className="font-mono text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors"
                    >
                      {orden.radicado}
                    </Link>
                    {overdue && (
                      <span className="block text-red-400 text-xs mt-0.5">⚠ Demorada</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-300">
                    {orden.pacientes
                      ? `${orden.pacientes.nombre} ${orden.pacientes.apellido}`
                      : '—'}
                  </td>
                  <td className="px-5 py-3 text-slate-400 max-w-[140px]">
                    <span className="truncate block">{orden.tipo_trabajo}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-400">
                    {orden.laboratorios?.nombre ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-xs">
                    {orden.fecha_estimada_entrega
                      ? format(new Date(orden.fecha_estimada_entrega), 'dd/MM/yyyy', { locale: es })
                      : '—'}
                  </td>
                  <td className="px-5 py-3 text-slate-300 font-mono text-xs">
                    {orden.precio_venta > 0 ? formatCOP(orden.precio_venta) : '—'}
                  </td>
                  <td className="px-5 py-3">
                    {orden.margen_ganancia > 0 ? (
                      <span className={`text-xs font-semibold ${orden.margen_ganancia >= 30 ? 'text-emerald-400' : orden.margen_ganancia >= 15 ? 'text-amber-400' : 'text-red-400'}`}>
                        {orden.margen_ganancia.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${ORDEN_ESTADO_COLORS[orden.estado]}`}>
                      {ORDEN_ESTADO_LABELS[orden.estado]}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/ordenes/${orden.id}`}
                      className="text-slate-500 hover:text-sky-400 transition-colors"
                      title="Ver detalle"
                    >
                      →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
