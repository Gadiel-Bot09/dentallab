'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { crearEspecialidad } from '../actions'

export default function EspecialidadForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const result = await crearEspecialidad(formData)

      if (!result.success) throw new Error(result.error)

      toast.success('Especialidad creada')
      ;(e.target as HTMLFormElement).reset()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">
          Nombre de Especialidad <span className="text-red-400">*</span>
        </label>
        <input
          name="nombre"
          required
          minLength={3}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:ring-2 focus:ring-sky-500/50"
          placeholder="Ej: Ortodoncia"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">
          Descripción (Opcional)
        </label>
        <textarea
          name="descripcion"
          rows={3}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:ring-2 focus:ring-sky-500/50 resize-none"
          placeholder="Breve descripción..."
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-sky-500 hover:bg-sky-400 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {isLoading ? 'Guardando...' : 'Crear Especialidad'}
      </button>
    </form>
  )
}
