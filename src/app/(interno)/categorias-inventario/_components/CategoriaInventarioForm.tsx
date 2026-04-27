'use client'
// src/app/(interno)/categorias-inventario/_components/CategoriaInventarioForm.tsx
import { useState, useTransition } from 'react'
import { crearCategoriaAction, eliminarCategoriaAction, toggleCategoriaAction } from '../actions'

interface Categoria {
  id: string
  nombre: string
  descripcion: string | null
  activa: boolean
}

export default function CategoriaInventarioForm({
  categorias,
}: {
  categorias: Categoria[]
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
        await crearCategoriaAction(fd)
        form.reset()
      } catch (err: any) {
        setError(err.message)
      }
    })
  }

  async function handleToggle(id: string, activa: boolean) {
    startTransition(async () => {
      try {
        await toggleCategoriaAction(id, !activa)
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta categoría? Si hay materiales usándola, no podrás borrarla.')) return
    startTransition(async () => {
      try {
        await eliminarCategoriaAction(id)
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
          <h2 className="text-white font-semibold mb-4">Nueva Categoría</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl">{error}</div>}
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Nombre *</label>
              <input
                type="text"
                name="nombre"
                required
                placeholder="Ej. Resinas Dentales"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-sky-500/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Descripción</label>
              <textarea
                name="descripcion"
                rows={3}
                placeholder="Notas internas"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-sky-500/40 focus:outline-none resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isPending ? 'Guardando...' : 'Crear Categoría'}
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
              {categorias.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                    No hay categorías registradas.
                  </td>
                </tr>
              ) : (
                categorias.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-white font-medium">{c.nombre}</p>
                      {c.descripcion && <p className="text-slate-500 text-xs mt-1">{c.descripcion}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggle(c.id, c.activa)}
                        disabled={isPending}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          c.activa 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {c.activa ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(c.id)}
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
