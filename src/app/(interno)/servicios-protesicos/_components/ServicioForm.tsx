'use client'
// src/app/(interno)/servicios-protesicos/_components/ServicioForm.tsx
import { useState, useTransition } from 'react'
import { crearServicioAction, eliminarServicioAction, toggleServicioAction } from '../actions'

interface Servicio {
  id: string
  nombre: string
  descripcion: string | null
  activo: boolean
}

export default function ServicioForm({
  servicios,
}: {
  servicios: Servicio[]
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const form = e.currentTarget
    startTransition(async () => {
      try {
        await crearServicioAction(fd)
        form.reset()
      } catch (err: any) {
        setError(err.message)
      }
    })
  }

  async function handleToggle(id: string, activo: boolean) {
    startTransition(async () => {
      try {
        await toggleServicioAction(id, !activo)
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar este servicio? Si hay órdenes activas usándolo, no podrás borrarlo.')) return
    startTransition(async () => {
      try {
        await eliminarServicioAction(id)
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Formulario */}
      <div className="lg:col-span-1">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Nuevo Servicio</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl">{error}</div>}
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Nombre *</label>
              <input
                type="text"
                name="nombre"
                required
                placeholder="Ej. Corona Zirconio"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-sky-500/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Descripción</label>
              <textarea
                name="descripcion"
                rows={3}
                placeholder="Especificaciones o notas internas"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-sky-500/40 focus:outline-none resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isPending ? 'Guardando...' : 'Crear Servicio'}
            </button>
          </form>
        </div>
      </div>

      {/* Lista */}
      <div className="lg:col-span-2">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 font-medium">Nombre</th>
                <th className="px-6 py-4 font-medium">Estado</th>
                <th className="px-6 py-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {servicios.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                    No hay servicios registrados.
                  </td>
                </tr>
              ) : (
                servicios.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-white font-medium">{s.nombre}</p>
                      {s.descripcion && <p className="text-slate-500 text-xs mt-1">{s.descripcion}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggle(s.id, s.activo)}
                        disabled={isPending}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          s.activo 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {s.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(s.id)}
                        disabled={isPending}
                        className="text-slate-500 hover:text-red-400 transition-colors p-2"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
