'use client'
// src/app/(interno)/usuarios/_components/UsuarioForm.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { crearUsuarioAction } from '../actions'
import type { UserRol } from '@/types/database'

interface RoleOption {
  id: string
  codigo: string
  nombre: string
  rol_base: UserRol
  es_sistema: boolean
}

export default function UsuarioForm({
  laboratorios,
  roles = [],
  areas = [],
  farmacias = [],
}: {
  laboratorios: { id: string; nombre: string }[]
  roles?: RoleOption[]
  areas?: { id: string; codigo: string; nombre: string }[]
  farmacias?: { id: string; codigo: string; nombre: string }[]
}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rolId, setRolId] = useState(roles.find((r) => r.codigo === 'auxiliar')?.id || roles[0]?.id || '')
  const [rolBaseFallback, setRolBaseFallback] = useState<UserRol>('auxiliar')
  const [laboratorioId, setLaboratorioId] = useState('')
  const [areaIds, setAreaIds] = useState<string[]>([])
  const [farmaciaIds, setFarmaciaIds] = useState<string[]>([])

  const selectedRole = roles.find((r) => r.id === rolId)
  const effectiveBase: UserRol = selectedRole ? selectedRole.rol_base : rolBaseFallback
  const requiresLab = effectiveBase === 'odontologo' || effectiveBase === 'laboratorio'

  function toggleItem(list: string[], id: string, setter: (v: string[]) => void) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (requiresLab && !laboratorioId) {
      toast.error('Debe seleccionar un laboratorio o clínica para este rol')
      return
    }
    setIsLoading(true)
    try {
      const result = await crearUsuarioAction({
        nombre,
        apellido,
        email,
        password,
        rol_id: selectedRole ? selectedRole.id : null,
        rol_base: effectiveBase,
        laboratorio_id: requiresLab ? laboratorioId : null,
        area_ids: areaIds,
        farmacia_ids: farmaciaIds,
      })

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
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">
            Nombre <span className="text-red-400">*</span>
          </label>
          <input
            required
            minLength={2}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:ring-2 focus:ring-sky-500/50"
            placeholder="Ej: María"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">
            Apellido <span className="text-red-400">*</span>
          </label>
          <input
            required
            minLength={2}
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:ring-2 focus:ring-sky-500/50"
            placeholder="Ej: Gómez"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">
            Correo Electrónico (Usuario) <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            required
            autoComplete="new-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:ring-2 focus:ring-sky-500/50"
            placeholder="Ej: maria@clinica.com"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">
            Contraseña Inicial <span className="text-red-400">*</span>
          </label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:ring-2 focus:ring-sky-500/50"
            placeholder="Mínimo 6 caracteres"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">
            Rol en el Sistema <span className="text-red-400">*</span>
          </label>
          {roles.length > 0 ? (
            <select
              value={rolId}
              onChange={(e) => setRolId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-sky-500/50"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre} {!r.es_sistema ? '(Personalizado)' : ''}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={rolBaseFallback}
              onChange={(e) => setRolBaseFallback(e.target.value as UserRol)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-sky-500/50"
            >
              <option value="auxiliar">Auxiliar / Empleado</option>
              <option value="recepcionista">Recepcionista</option>
              <option value="farmacia">Farmacia / Regente de Farmacia</option>
              <option value="jefe_area">Jefe de Área / Solicitante</option>
              <option value="admin">Administrador</option>
              <option value="odontologo">Clínica - Odontólogo (Externo)</option>
              <option value="laboratorio">Laboratorio Aliado (Externo)</option>
            </select>
          )}
        </div>

        {requiresLab && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Clínica / Laboratorio al que pertenece <span className="text-red-400">*</span>
            </label>
            <select
              required
              value={laboratorioId}
              onChange={(e) => setLaboratorioId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-sky-500/50"
            >
              <option value="">-- Seleccionar Clínica --</option>
              {laboratorios.map((lab) => (
                <option key={lab.id} value={lab.id}>
                  {lab.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Asignación de áreas y farmacias */}
      {(areas.length > 0 || farmacias.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
          <div>
            <p className="text-xs font-semibold text-sky-400 uppercase mb-2">
              🏢 Áreas Institucionales ({areaIds.length})
            </p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {areas.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={areaIds.includes(a.id)}
                    onChange={() => toggleItem(areaIds, a.id, setAreaIds)}
                    className="rounded border-slate-600 bg-slate-900 text-sky-500"
                  />
                  <span>{a.codigo} — {a.nombre}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-emerald-400 uppercase mb-2">
              🏥 Farmacias / Bodegas ({farmaciaIds.length})
            </p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {farmacias.map((f) => (
                <label key={f.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={farmaciaIds.includes(f.id)}
                    onChange={() => toggleItem(farmaciaIds, f.id, setFarmaciaIds)}
                    className="rounded border-slate-600 bg-slate-900 text-emerald-500"
                  />
                  <span>{f.codigo} — {f.nombre}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

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
          className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-sky-500/20 transition-all duration-200 disabled:opacity-50"
        >
          {isLoading ? 'Creando...' : 'Registrar Usuario'}
        </button>
      </div>
    </form>
  )
}
