'use client'
// src/components/modals/CrearServicioModal.tsx
import { useState, useTransition } from 'react'
import { crearServicioAction } from '@/app/(interno)/servicios-protesicos/actions'

interface CrearServicioModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (nuevoServicio: string) => void
}

export default function CrearServicioModal({
  isOpen,
  onClose,
  onSuccess,
}: CrearServicioModalProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const nombre = fd.get('nombre') as string

    startTransition(async () => {
      try {
        await crearServicioAction(fd)
        onSuccess(nombre)
      } catch (err: any) {
        setError(err.message)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">Nuevo Servicio Protésico</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre del Servicio *</label>
            <input
              type="text"
              name="nombre"
              required
              placeholder="Ej. Placa Essix"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Descripción (Opcional)</label>
            <textarea
              name="descripcion"
              rows={2}
              placeholder="Detalles sobre este tipo de trabajo..."
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 resize-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isPending ? 'Creando...' : 'Crear y Seleccionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
