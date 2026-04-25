'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { crearLaboratorio, actualizarLaboratorio } from '../actions'

const formSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  contacto: z.string().optional().nullable(),
  email: z.string().email('Email inválido').optional().or(z.literal('')).nullable(),
  telefono: z.string().optional().nullable(),
  portal_activo: z.boolean(),
})

type FormData = z.infer<typeof formSchema>

export default function LaboratorioForm({ initialData }: { initialData?: any }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: initialData?.nombre || '',
      contacto: initialData?.contacto || '',
      email: initialData?.email || '',
      telefono: initialData?.telefono || '',
      portal_activo: initialData?.portal_activo || false,
    },
  })

  async function onSubmit(data: FormData) {
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('nombre', data.nombre)
      if (data.contacto) formData.append('contacto', data.contacto)
      if (data.email) formData.append('email', data.email)
      if (data.telefono) formData.append('telefono', data.telefono)
      formData.append('portal_activo', String(data.portal_activo))

      const result = initialData 
        ? await actualizarLaboratorio(initialData.id, formData)
        : await crearLaboratorio(formData)

      if (!result.success) throw new Error(result.error)

      toast.success(initialData ? 'Laboratorio actualizado' : 'Laboratorio creado correctamente')
      router.push('/laboratorios')
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
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-slate-300">
            Nombre del Laboratorio / Clínica <span className="text-red-400">*</span>
          </label>
          <input
            {...register('nombre')}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all"
            placeholder="Ej: DentalCorp"
          />
          {errors.nombre && <p className="text-red-400 text-xs">{errors.nombre.message}</p>}
        </div>

        {/* Contacto */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Nombre de Contacto</label>
          <input
            {...register('contacto')}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all"
            placeholder="Ej: Dr. Juan Pérez"
          />
        </div>

        {/* Teléfono */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Teléfono</label>
          <input
            {...register('telefono')}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all"
            placeholder="Ej: 300 123 4567"
          />
        </div>

        {/* Email */}
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-slate-300">Correo Electrónico</label>
          <input
            type="email"
            {...register('email')}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all"
            placeholder="Ej: contacto@dentalcorp.com"
          />
          {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
        </div>

        {/* Portal Activo */}
        <div className="space-y-2 md:col-span-2 pt-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register('portal_activo')}
              className="w-5 h-5 rounded border-slate-800 bg-slate-950 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900"
            />
            <span className="text-sm font-medium text-slate-300">
              Activar acceso al Portal Externo
            </span>
          </label>
          <p className="text-xs text-slate-500 ml-8">
            Si está activo, este laboratorio/clínica podrá iniciar sesión en el portal externo para ver y enviar órdenes.
          </p>
        </div>
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
              Guardando...
            </>
          ) : (
            initialData ? 'Guardar Cambios' : 'Registrar Laboratorio'
          )}
        </button>
      </div>
    </form>
  )
}
