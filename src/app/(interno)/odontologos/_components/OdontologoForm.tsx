'use client'
// src/app/(interno)/odontologos/_components/OdontologoForm.tsx
import { useState, useTransition } from 'react'
import { crearOdontologoRapido } from '../actions'

interface OdontologoFormProps {
  especialidades: { id: string; nombre: string }[]
  laboratorios: { id: string; nombre: string }[]
}

export default function OdontologoForm({ especialidades, laboratorios }: OdontologoFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const fd = new FormData(e.currentTarget)
    const form = e.currentTarget

    startTransition(async () => {
      try {
        const result = await crearOdontologoRapido(fd)
        if (!result.success) throw new Error(result.error)
        setSuccess(`Odontólogo registrado. Contraseña inicial: ${fd.get('documento')}`)
        form.reset()
      } catch (err: any) {
        setError(err.message)
      }
    })
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <h2 className="text-lg font-bold text-white mb-5">Registrar Nuevo Odontólogo</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3 rounded-xl">✓ {success}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombres *</label>
            <input
              name="nombre"
              required
              minLength={2}
              placeholder="Juan Carlos"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Apellidos *</label>
            <input
              name="apellido"
              required
              minLength={2}
              placeholder="Martínez López"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              N° Documento *
              <span className="ml-2 text-xs font-normal text-sky-400 bg-sky-400/10 border border-sky-400/20 px-2 py-0.5 rounded-full">Se usará como contraseña</span>
            </label>
            <input
              name="documento"
              required
              minLength={5}
              placeholder="12345678"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Correo Electrónico *</label>
            <input
              name="email"
              type="email"
              required
              placeholder="doctor@clinica.com"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Especialidad</label>
            <select
              name="especialidad_id"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            >
              <option value="">Odontología General</option>
              {especialidades.map(e => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Clínica (Opcional)</label>
            <select
              name="laboratorio_id"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            >
              <option value="">Independiente</option>
              {laboratorios.map(l => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-4 flex justify-end border-t border-slate-800">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50"
          >
            {isPending ? 'Registrando...' : '+ Registrar Odontólogo'}
          </button>
        </div>
      </form>
    </div>
  )
}
