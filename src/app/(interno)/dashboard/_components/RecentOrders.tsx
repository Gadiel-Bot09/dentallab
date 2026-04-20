// src/app/(interno)/dashboard/_components/RecentOrders.tsx
import Link from 'next/link'
import { ORDEN_ESTADO_LABELS, ORDEN_ESTADO_COLORS, type OrdenEstado } from '@/types/database'

interface Order {
  id: string
  radicado: string
  tipo_trabajo: string
  estado: OrdenEstado
  created_at: string
  pacientes?: { nombre: string; apellido: string } | null
  laboratorios?: { nombre: string } | null
}

export default function RecentOrders({ orders }: { orders: Order[] }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <h2 className="font-semibold text-white">Órdenes Recientes</h2>
        <Link
          href="/ordenes"
          className="text-sky-400 hover:text-sky-300 text-sm transition-colors"
        >
          Ver todas →
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="px-6 py-12 text-center text-slate-500">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm">No hay órdenes registradas</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-6 py-3 text-slate-400 font-medium">Radicado</th>
                <th className="px-6 py-3 text-slate-400 font-medium">Paciente</th>
                <th className="px-6 py-3 text-slate-400 font-medium">Trabajo</th>
                <th className="px-6 py-3 text-slate-400 font-medium">Laboratorio</th>
                <th className="px-6 py-3 text-slate-400 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-6 py-3">
                    <Link
                      href={`/ordenes/${order.id}`}
                      className="text-sky-400 hover:text-sky-300 font-mono text-xs font-semibold transition-colors"
                    >
                      {order.radicado}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-slate-300">
                    {order.pacientes
                      ? `${order.pacientes.nombre} ${order.pacientes.apellido}`
                      : '—'}
                  </td>
                  <td className="px-6 py-3 text-slate-400 max-w-[150px] truncate">
                    {order.tipo_trabajo}
                  </td>
                  <td className="px-6 py-3 text-slate-400">
                    {order.laboratorios?.nombre ?? '—'}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium ${ORDEN_ESTADO_COLORS[order.estado]}`}
                    >
                      {ORDEN_ESTADO_LABELS[order.estado]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
