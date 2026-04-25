'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { crearUsuario } from '../actions'

const formSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  apellido: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  rol: z.enum(['admin', 'odontologo', 'auxiliar', 'recepcionista', 'laboratorio']),
  laboratorio_id: z.string().optional().nullable(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
}).refine(data => {
  if ((data.rol === 'odontologo' || data.rol === 'laboratorio') && !data.laboratorio_id) {
    return false
  }
  return true
}, {
  message: 'Debe seleccionar un laboratorio/clínica para este rol',
  path: ['laboratorio_id'],
})

type FormData = z.infer<typeof formSchema>

export default function UsuarioForm({ laboratorios }: { laboratorios: any[] }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: '',
      apellido: '',
      email: '',
      rol: 'auxiliar',
      laboratorio_id: '',
      password: '',
    },
  })

  const watchRol = watch('rol')
  const requiresLab = watchRol === 'odontologo' || watchRol === 'laboratorio'

  async function onSubmit(data: FormData) {
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('nombre', data.nombre)
      formData.append('apellido', data.apellido)
      formData.append('email', data.email)
      formData.append('rol', data.rol)
      formData.append('password', data.password)
      
      if (requiresLab && data.laboratorio_id) {
        formData.append('laboratorio_id', data.laboratorio_id)
      }

      const result = await crearUsuario(formData)

      if (!result.success) throw new Error(result.error)

      toast.success('Usuario creado correctamente')
      router.push('/usuarios')
    } catch (error: any) {
      toast.error('Error al guardar: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nombre */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">
            Nombre <span className="text-red-400">*</span>
          </label>
          <input
            {...register('nombre')}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all"
            placeholder="Ej: María"
          />
          {errors.nombre && <p className="text-red-400 text-xs">{errors.nombre.message}</p>}
        </div>

        {/* Apellido */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">
            Apellido <span className="text-red-400">*</span>
          </label>
          <input
            {...register('apellido')}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all"
            placeholder="Ej: Gómez"
          />
          {errors.apellido && <p className="text-red-400 text-xs">{errors.apellido.message}</p>}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">
            Correo Electrónico (Usuario) <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            {...register('email')}
            autoComplete="new-email"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all"
            placeholder="Ej: maria@clinica.com"
          />
          {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">
            Contraseña Inicial <span className="text-red-400">*</span>
          </label>
          <input
            type="password"
            {...register('password')}
            autoComplete="new-password"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all"
            placeholder="Mínimo 6 caracteres"
          />
          {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
        </div>

        {/* Rol */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">
            Rol en el Sistema <span className="text-red-400">*</span>
          </label>
          <select
            {...register('rol')}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all"
          >
            <option value="auxiliar">Auxiliar / Empleado</option>
            <option value="recepcionista">Recepcionista</option>
            <option value="admin">Administrador</option>
            <option value="odontologo">Clínica - Odontólogo (Externo)</option>
            <option value="laboratorio">Laboratorio Aliado (Externo)</option>
          </select>
        </div>

        {/* Laboratorio ID (Conditional) */}
        {requiresLab && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Clínica / Laboratorio al que pertenece <span className="text-red-400">*</span>
            </label>
            <select
              {...register('laboratorio_id')}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all"
            >
              <option value="">-- Seleccionar Clínica --</option>
              {laboratorios.map(lab => (
                <option key={lab.id} value={lab.id}>{lab.nombre}</option>
              ))}
            </select>
            {errors.laboratorio_id && <p className="text-red-400 text-xs">{errors.laboratorio_id.message}</p>}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-800">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          disabled={isLoading}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-sky-500/20 transition-all duration-200 disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Creando...
            </>
          ) : (
            'Registrar Usuario'
          )}
        </button>
      </div>
    </form>
  )
}
