'use client'
// src/app/(interno)/pacientes/nuevo/_components/NuevoPacienteForm.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { crearPacienteAction } from '../../actions'

import CrearOdontologoModal from '@/components/modals/CrearOdontologoModal'

export default function NuevoPacienteForm({
  initialOdontologos,
  especialidades,
  laboratorios
}: {
  initialOdontologos: { id: string; nombre: string; apellido: string }[]
  especialidades: any[]
  laboratorios: any[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [odontologos, setOdontologos] = useState(initialOdontologos)
  const [selectedOdontologo, setSelectedOdontologo] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    try {
      await crearPacienteAction(fd)
      // Redirect happens inside action
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre *</label>
          <input
            name="nombre"
            required
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            placeholder="Juan"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Apellido *</label>
          <input
            name="apellido"
            required
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            placeholder="Pérez"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Cédula *</label>
          <input
            name="cedula"
            required
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            placeholder="1234567890"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Fecha de Nacimiento</label>
          <input
            name="fecha_nacimiento"
            type="date"
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Teléfono</label>
          <input
            name="telefono"
            type="tel"
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            placeholder="+57 300 000 0000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Correo Electrónico</label>
          <input
            name="email"
            type="email"
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            placeholder="paciente@correo.com"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Odontólogo Tratante</label>
          <div className="flex gap-2">
            <select
              name="odontologo_id"
              value={selectedOdontologo}
              onChange={(e) => setSelectedOdontologo(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            >
              <option value="">Seleccione un odontólogo...</option>
              {odontologos.map(o => (
                <option key={o.id} value={o.id}>Dr(a). {o.nombre} {o.apellido}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="shrink-0 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-400 rounded-xl text-sm font-bold transition-colors"
              title="Crear Odontólogo Rápido"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Crear Paciente'}
        </button>
      </div>

      <CrearOdontologoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        especialidades={especialidades}
        laboratorios={laboratorios}
        onSuccess={(nuevo) => {
          setOdontologos(prev => [...prev, nuevo].sort((a, b) => a.apellido.localeCompare(b.apellido)))
          setSelectedOdontologo(nuevo.id)
          setIsModalOpen(false)
        }}
      />
    </form>
  )
}
