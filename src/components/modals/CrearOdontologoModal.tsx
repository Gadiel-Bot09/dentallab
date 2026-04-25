'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { crearOdontologoRapido } from '../../app/(interno)/odontologos/actions'

const schema = z.object({
  nombre: z.string().min(2, 'Obligatorio'),
  apellido: z.string().min(2, 'Obligatorio'),
  documento: z.string().min(5, 'Obligatorio'),
  email: z.string().email('Email inválido'),
  especialidad_id: z.string().optional().nullable(),
  laboratorio_id: z.string().optional().nullable(),
})

type FormData = z.infer<typeof schema>

interface CrearOdontologoModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (nuevoOdontologo: { id: string; nombre: string; apellido: string }) => void
  especialidades: any[]
  laboratorios: any[]
}

export default function CrearOdontologoModal({ isOpen, onClose, onSuccess, especialidades, laboratorios }: CrearOdontologoModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema)
  })

  if (!isOpen) return null

  async function onSubmit(data: FormData) {
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('nombre', data.nombre)
      formData.append('apellido', data.apellido)
      formData.append('email', data.email)
      formData.append('documento', data.documento)
      if (data.especialidad_id) formData.append('especialidad_id', data.especialidad_id)
      if (data.laboratorio_id) formData.append('laboratorio_id', data.laboratorio_id)

      const result = await crearOdontologoRapido(formData)

      if (!result.success) throw new Error(result.error)

      toast.success('Odontólogo registrado con éxito (Contraseña = Documento)')
      reset()
      onSuccess({ id: result.userId as string, nombre: data.nombre, apellido: data.apellido })
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">Registro Rápido de Odontólogo</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Nombres *</label>
              <input {...register('nombre')} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-sky-500" />
              {errors.nombre && <p className="text-red-400 text-xs">{errors.nombre.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Apellidos *</label>
              <input {...register('apellido')} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-sky-500" />
              {errors.apellido && <p className="text-red-400 text-xs">{errors.apellido.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Documento *</label>
              <input {...register('documento')} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-sky-500" placeholder="Se usará como clave" />
              {errors.documento && <p className="text-red-400 text-xs">{errors.documento.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Correo Electrónico *</label>
              <input type="email" {...register('email')} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-sky-500" />
              {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Especialidad</label>
              <select {...register('especialidad_id')} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-sky-500">
                <option value="">General</option>
                {especialidades.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Clínica (Opcional)</label>
              <select {...register('laboratorio_id')} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-sky-500">
                <option value="">Independiente</option>
                {laboratorios.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 text-sm text-slate-300 hover:text-white">Cancelar</button>
            <button type="submit" disabled={isLoading} className="px-5 py-2 text-sm font-medium bg-sky-500 hover:bg-sky-400 text-white rounded-lg disabled:opacity-50">
              {isLoading ? 'Guardando...' : 'Crear y Asignar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
