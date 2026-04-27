'use client'
// src/app/(interno)/perfil/_components/PerfilForm.tsx
import { useState, useTransition } from 'react'
import { actualizarPerfilAction, cambiarPasswordAction } from '../actions'

interface PerfilFormProps {
  usuario: {
    nombre: string
    apellido: string
    email: string
    rol: string
  }
}

export default function PerfilForm({ usuario }: PerfilFormProps) {
  const [isPendingPerfil, startTransitionPerfil] = useTransition()
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null)
  const [successPerfil, setSuccessPerfil] = useState(false)

  const [isPendingPassword, startTransitionPassword] = useTransition()
  const [errorPassword, setErrorPassword] = useState<string | null>(null)
  const [successPassword, setSuccessPassword] = useState(false)

  async function handleUpdatePerfil(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorPerfil(null)
    setSuccessPerfil(false)
    const fd = new FormData(e.currentTarget)
    
    startTransitionPerfil(async () => {
      try {
        await actualizarPerfilAction(fd)
        setSuccessPerfil(true)
        setTimeout(() => setSuccessPerfil(false), 3000)
      } catch (err: any) {
        setErrorPerfil(err.message)
      }
    })
  }

  async function handleUpdatePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorPassword(null)
    setSuccessPassword(false)
    const fd = new FormData(e.currentTarget)
    const form = e.currentTarget

    startTransitionPassword(async () => {
      try {
        await cambiarPasswordAction(fd)
        setSuccessPassword(true)
        form.reset()
        setTimeout(() => setSuccessPassword(false), 3000)
      } catch (err: any) {
        setErrorPassword(err.message)
      }
    })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Datos Personales */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8">
        <h2 className="text-lg font-bold text-white mb-6">Información Personal</h2>
        
        <form onSubmit={handleUpdatePerfil} className="space-y-5">
          {errorPerfil && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
              {errorPerfil}
            </div>
          )}
          {successPerfil && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3 rounded-xl">
              Perfil actualizado exitosamente.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre</label>
            <input
              type="text"
              name="nombre"
              defaultValue={usuario.nombre}
              required
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Apellido</label>
            <input
              type="text"
              name="apellido"
              defaultValue={usuario.apellido}
              required
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Correo Electrónico</label>
            <input
              type="email"
              disabled
              defaultValue={usuario.email}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-500 text-sm cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">El correo no puede ser modificado.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Rol en el Sistema</label>
            <input
              type="text"
              disabled
              defaultValue={usuario.rol.toUpperCase()}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-500 text-sm cursor-not-allowed font-mono"
            />
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={isPendingPerfil}
              className="w-full px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isPendingPerfil ? 'Guardando...' : 'Actualizar Datos'}
            </button>
          </div>
        </form>
      </div>

      {/* Cambiar Contraseña */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8">
        <h2 className="text-lg font-bold text-white mb-6">Seguridad</h2>
        
        <form onSubmit={handleUpdatePassword} className="space-y-5">
          {errorPassword && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
              {errorPassword}
            </div>
          )}
          {successPassword && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3 rounded-xl">
              Contraseña actualizada exitosamente.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nueva Contraseña</label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmar Nueva Contraseña</label>
            <input
              type="password"
              name="confirmPassword"
              required
              minLength={6}
              placeholder="Vuelve a escribir la contraseña"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={isPendingPassword}
              className="w-full px-5 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isPendingPassword ? 'Actualizando...' : 'Cambiar Contraseña'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
