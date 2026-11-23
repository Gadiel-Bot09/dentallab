'use client'
// src/app/(interno)/usuarios/_components/RolesManagerPanel.tsx
import { useState, useTransition, useMemo } from 'react'
import {
  ALL_PERMISOS,
  HOME_PATH_OPTIONS,
  MODULOS_RBAC,
  PERMISOS_CATALOGO,
  ROL_BASE_OPTIONS,
  ROL_COLOR_STYLES,
  type ModuloCodigo,
  type PermisoCodigo,
  type RolColor,
  type RolConPermisos,
} from '@/lib/rbac'
import type { UserRol } from '@/types/database'
import {
  actualizarRolAction,
  crearRolAction,
  eliminarRolAction,
} from '../actions'

interface Props {
  roles: RolConPermisos[]
  canManageRoles: boolean
  onRefresh: () => void
}

const COLOR_KEYS = Object.keys(ROL_COLOR_STYLES) as RolColor[]

export default function RolesManagerPanel({ roles, canManageRoles, onRefresh }: Props) {
  const [isPending, startTransition] = useTransition()
  const [selectedId, setSelectedId] = useState<string>(roles[0]?.id || 'NEW')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [permSearch, setPermSearch] = useState('')

  const selectedRole = useMemo(
    () => (isCreating ? null : roles.find((r) => r.id === selectedId) || roles[0] || null),
    [roles, selectedId, isCreating]
  )

  // Form state del rol activo (editar o crear)
  const [nombre, setNombre] = useState(selectedRole?.nombre || '')
  const [descripcion, setDescripcion] = useState(selectedRole?.descripcion || '')
  const [color, setColor] = useState<RolColor>(selectedRole?.color || 'violet')
  const [rolBase, setRolBase] = useState<UserRol>(selectedRole?.rol_base || 'auxiliar')
  const [homePath, setHomePath] = useState(selectedRole?.home_path || '/dashboard')
  const [permisos, setPermisos] = useState<PermisoCodigo[]>(selectedRole?.permisos || [])

  function selectRoleForEdit(r: RolConPermisos) {
    setIsCreating(false)
    setSelectedId(r.id)
    setNombre(r.nombre)
    setDescripcion(r.descripcion || '')
    setColor(r.color || 'sky')
    setRolBase(r.rol_base)
    setHomePath(r.home_path || '/dashboard')
    setPermisos(r.codigo === 'admin' ? [...ALL_PERMISOS] : [...r.permisos])
    setError(null)
    setSuccessMsg(null)
  }

  function startNewRole(cloneFrom?: RolConPermisos) {
    setIsCreating(true)
    setSelectedId('NEW')
    setNombre(cloneFrom ? `${cloneFrom.nombre} (Personalizado)` : '')
    setDescripcion(cloneFrom?.descripcion || '')
    setColor(cloneFrom?.color || 'violet')
    setRolBase(cloneFrom && cloneFrom.rol_base !== 'admin' ? cloneFrom.rol_base : 'auxiliar')
    setHomePath(cloneFrom?.home_path || '/dashboard')
    setPermisos(cloneFrom ? [...cloneFrom.permisos] : ['dashboard.ver'])
    setError(null)
    setSuccessMsg(null)
  }

  const isLockedAdmin = !isCreating && selectedRole?.codigo === 'admin'
  const isSystemRole = !isCreating && Boolean(selectedRole?.es_sistema)

  function togglePerm(code: PermisoCodigo) {
    if (isLockedAdmin || !canManageRoles) return
    setPermisos((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    )
  }

  function setModulePerms(modulo: ModuloCodigo, enable: boolean) {
    if (isLockedAdmin || !canManageRoles) return
    const modCodes = PERMISOS_CATALOGO.filter((p) => p.modulo === modulo).map((p) => p.codigo)
    setPermisos((prev) => {
      const set = new Set(prev)
      modCodes.forEach((c) => (enable ? set.add(c) : set.delete(c)))
      return Array.from(set)
    })
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    if (!nombre.trim()) {
      setError('El nombre del rol es obligatorio')
      return
    }

    startTransition(async () => {
      if (isCreating) {
        const res = await crearRolAction({
          nombre: nombre.trim(),
          descripcion: descripcion.trim(),
          color,
          rol_base: rolBase,
          home_path: homePath,
          permisos,
        })
        if (!res.success) {
          setError(res.error || 'No se pudo crear el rol')
        } else {
          setSuccessMsg(`Rol "${nombre.trim()}" creado correctamente`)
          setIsCreating(false)
          if (res.id) setSelectedId(res.id)
          onRefresh()
        }
      } else if (selectedRole) {
        const res = await actualizarRolAction({
          id: selectedRole.id,
          nombre: nombre.trim(),
          descripcion: descripcion.trim(),
          color,
          rol_base: rolBase,
          home_path: homePath,
          permisos,
        })
        if (!res.success) {
          setError(res.error || 'No se pudo actualizar el rol')
        } else {
          setSuccessMsg(`Permisos del rol "${nombre.trim()}" actualizados`)
          onRefresh()
        }
      }
    })
  }

  function handleDelete() {
    if (!selectedRole || selectedRole.es_sistema) return
    if (!confirm(`¿Seguro que deseas eliminar el rol personalizado "${selectedRole.nombre}"?`)) return
    setError(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await eliminarRolAction(selectedRole.id)
      if (!res.success) {
        setError(res.error || 'No se pudo eliminar el rol')
      } else {
        onRefresh()
      }
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Columna izquierda: Lista de roles */}
      <div className="lg:col-span-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Roles Configurados ({roles.length})
          </h3>
          {canManageRoles && (
            <button
              type="button"
              onClick={() => startNewRole()}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-sky-600/20 transition-all"
            >
              + Nuevo Rol
            </button>
          )}
        </div>

        <div className="space-y-2">
          {roles.map((r) => {
            const active = !isCreating && selectedRole?.id === r.id
            const style = ROL_COLOR_STYLES[r.color] || ROL_COLOR_STYLES.sky
            const permCount = r.codigo === 'admin' ? ALL_PERMISOS.length : r.permisos.length
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => selectRoleForEdit(r)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                  active
                    ? 'bg-slate-800/80 border-sky-500 ring-1 ring-sky-500/30'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${style.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                    {r.nombre}
                  </span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                    {r.es_sistema ? 'Sistema' : 'Personalizado'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                  {r.descripcion || 'Sin descripción'}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-800/80">
                  <span>🔑 {permCount} / {ALL_PERMISOS.length} permisos</span>
                  <span>👥 {r.usuarios_count ?? 0} usuario(s)</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Columna derecha: Editor de Rol y Matriz de Permisos */}
      <div className="lg:col-span-8">
        <form
          onSubmit={handleSave}
          className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden"
        >
          {/* Header del editor */}
          <div className="px-6 py-4 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{isCreating ? '✨' : '🛡️'}</span>
                <span>
                  {isCreating
                    ? 'Crear Nuevo Rol Personalizado'
                    : `Configuración del Rol: ${selectedRole?.nombre || ''}`}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isLockedAdmin
                  ? 'El rol Administrador tiene acceso total garantizado y no puede ser restringido.'
                  : 'Define exactamente a qué módulos y acciones (solicitudes de insumos, prótesis, farmacia, etc.) puede acceder este rol.'}
              </p>
            </div>

            {!isCreating && selectedRole && canManageRoles && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => startNewRole(selectedRole)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-medium rounded-lg border border-slate-700"
                  title="Crear un rol personalizado copiando los permisos de este rol"
                >
                  📋 Clonar Rol
                </button>
                {!selectedRole.es_sistema && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isPending}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg border border-red-500/30"
                  >
                    🗑️ Eliminar
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl">
                ⚠️ {error}
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl">
                ✅ {successMsg}
              </div>
            )}

            {/* Metadatos del rol */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nombre del Rol <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isLockedAdmin || !canManageRoles}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Coordinador Clínico, Auxiliar de Prótesis..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Página Inicial al Iniciar Sesión
                </label>
                <select
                  disabled={isLockedAdmin || !canManageRoles}
                  value={homePath}
                  onChange={(e) => setHomePath(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white disabled:opacity-60"
                >
                  {HOME_PATH_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Descripción del Rol
                </label>
                <input
                  type="text"
                  disabled={isLockedAdmin || !canManageRoles}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Describe brevemente las responsabilidades de este perfil..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Perfil Base (Compatibilidad Portal / Seguridad DB)
                </label>
                <select
                  disabled={isSystemRole || isLockedAdmin || !canManageRoles}
                  value={rolBase}
                  onChange={(e) => setRolBase(e.target.value as UserRol)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white disabled:opacity-60"
                >
                  {ROL_BASE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  {ROL_BASE_OPTIONS.find((o) => o.value === rolBase)?.desc}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Color Distintivo
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_KEYS.map((c) => {
                    const st = ROL_COLOR_STYLES[c]
                    const selected = color === c
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={isLockedAdmin || !canManageRoles}
                        onClick={() => setColor(c)}
                        title={st.label}
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                          selected
                            ? 'border-white scale-110 ring-2 ring-white/30'
                            : 'border-slate-700 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full ${st.dot}`} />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Matriz de Permisos por Módulo */}
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Matriz de Permisos ({permisos.length} / {ALL_PERMISOS.length} activos)
                  </h4>
                </div>
                <input
                  type="text"
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  placeholder="Buscar permiso (ej: insumos, prótesis, despachar, lotes)..."
                  className="w-full sm:w-72 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500"
                />
              </div>

              <div className="space-y-3">
                {MODULOS_RBAC.map((mod) => {
                  const modPerms = PERMISOS_CATALOGO.filter(
                    (p) =>
                      p.modulo === mod.codigo &&
                      (!permSearch.trim() ||
                        p.nombre.toLowerCase().includes(permSearch.toLowerCase()) ||
                        p.descripcion.toLowerCase().includes(permSearch.toLowerCase()) ||
                        p.codigo.toLowerCase().includes(permSearch.toLowerCase()))
                  )
                  if (modPerms.length === 0) return null

                  const activeInMod = modPerms.filter((p) => permisos.includes(p.codigo)).length

                  return (
                    <div
                      key={mod.codigo}
                      className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden"
                    >
                      <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{mod.icono}</span>
                          <div>
                            <p className="text-xs font-bold text-white">{mod.titulo}</p>
                            <p className="text-[11px] text-slate-500">{mod.subtitulo}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${mod.badgeClass}`}>
                            {activeInMod} / {modPerms.length}
                          </span>
                          {!isLockedAdmin && canManageRoles && (
                            <>
                              <button
                                type="button"
                                onClick={() => setModulePerms(mod.codigo, true)}
                                className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-emerald-600/20 text-emerald-400 font-semibold"
                              >
                                Todo
                              </button>
                              <button
                                type="button"
                                onClick={() => setModulePerms(mod.codigo, false)}
                                className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-400 font-semibold"
                              >
                                Ninguno
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3">
                        {modPerms.map((p) => {
                          const checked = isLockedAdmin || permisos.includes(p.codigo)
                          return (
                            <label
                              key={p.codigo}
                              className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all ${
                                isLockedAdmin || !canManageRoles
                                  ? 'cursor-default opacity-80'
                                  : 'cursor-pointer'
                              } ${
                                checked
                                  ? 'bg-sky-500/10 border-sky-500/35 text-white'
                                  : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isLockedAdmin || !canManageRoles}
                                onChange={() => togglePerm(p.codigo)}
                                className="mt-0.5 rounded border-slate-600 bg-slate-900 text-sky-500"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold leading-tight">{p.nombre}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                                  {p.descripcion}
                                </p>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Footer guardar */}
          {!isLockedAdmin && canManageRoles && (
            <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end gap-2">
              {isCreating && (
                <button
                  type="button"
                  onClick={() => {
                    if (roles[0]) selectRoleForEdit(roles[0])
                    else setIsCreating(false)
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-sky-500/20"
              >
                {isPending
                  ? 'Guardando...'
                  : isCreating
                  ? 'Crear Rol Personalizado'
                  : 'Guardar Permisos del Rol'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
