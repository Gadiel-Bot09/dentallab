'use client'
// src/app/(interno)/usuarios/_components/UsuariosGestionClient.tsx
import { useState, useTransition, useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ALL_PERMISOS,
  MODULOS_RBAC,
  PERMISOS_CATALOGO,
  ROL_COLOR_STYLES,
  type ModuloCodigo,
  type RolConPermisos,
} from '@/lib/rbac'
import {
  resetPasswordUsuarioAction,
  toggleEstadoUsuario,
} from '../actions'
import ModalUsuarioEditor, { type UsuarioRowData } from './ModalUsuarioEditor'
import RolesManagerPanel from './RolesManagerPanel'

interface Props {
  usuarios: UsuarioRowData[]
  roles: RolConPermisos[]
  areas: { id: string; codigo: string; nombre: string }[]
  farmacias: { id: string; codigo: string; nombre: string }[]
  laboratorios: { id: string; nombre: string }[]
  currentUserId: string
  canManageUsers: boolean
  canManageRoles: boolean
  rbacMigrationReady: boolean
}

export default function UsuariosGestionClient({
  usuarios,
  roles,
  areas,
  farmacias,
  laboratorios,
  currentUserId,
  canManageUsers,
  canManageRoles,
  rbacMigrationReady,
}: Props) {
  const [activeTab, setActiveTab] = useState<'usuarios' | 'roles' | 'matriz'>('usuarios')
  const [isPending, startTransition] = useTransition()

  // Filtros de usuarios
  const [search, setSearch] = useState('')
  const [rolFilter, setRolFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<'todos' | 'activos' | 'inactivos'>('todos')

  // Filtros de matriz
  const [matrizModFilter, setMatrizModFilter] = useState<ModuloCodigo | 'todos'>('todos')

  // Modales
  const [modalUsuario, setModalUsuario] = useState<{
    open: boolean
    mode: 'create' | 'edit'
    tab: 'datos' | 'alcance' | 'permisos'
    usuario: UsuarioRowData | null
  }>({ open: false, mode: 'create', tab: 'datos', usuario: null })

  const [modalPassword, setModalPassword] = useState<UsuarioRowData | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null)

  const roleMap = useMemo(() => {
    const byId = new Map<string, RolConPermisos>()
    const byCode = new Map<string, RolConPermisos>()
    roles.forEach((r) => {
      byId.set(r.id, r)
      byCode.set(r.codigo, r)
    })
    return { byId, byCode }
  }, [roles])

  const areaMap = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas])
  const farmMap = useMemo(() => new Map(farmacias.map((f) => [f.id, f])), [farmacias])

  function resolveUserRole(u: UsuarioRowData): RolConPermisos | undefined {
    if (u.rol_id && roleMap.byId.has(u.rol_id)) return roleMap.byId.get(u.rol_id)
    return roleMap.byCode.get(u.rol)
  }

  const filteredUsuarios = useMemo(() => {
    const q = search.toLowerCase().trim()
    return usuarios.filter((u) => {
      const r = resolveUserRole(u)
      if (q) {
        const match =
          u.nombre.toLowerCase().includes(q) ||
          u.apellido.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (r?.nombre || u.rol).toLowerCase().includes(q)
        if (!match) return false
      }
      if (rolFilter && r?.id !== rolFilter && u.rol !== rolFilter) return false
      if (estadoFilter === 'activos' && !u.activo) return false
      if (estadoFilter === 'inactivos' && u.activo) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarios, search, rolFilter, estadoFilter, roleMap])

  // KPIs
  const totalUsuarios = usuarios.length
  const activosCount = usuarios.filter((u) => u.activo).length
  const rolesPersonalizados = roles.filter((r) => !r.es_sistema).length
  const usuariosConOverrides = usuarios.filter((u) => u.overrides.length > 0).length

  function handleToggleEstado(u: UsuarioRowData) {
    const accion = u.activo ? 'desactivar' : 'activar'
    if (!confirm(`¿Deseas ${accion} la cuenta de ${u.nombre} ${u.apellido}?`)) return
    startTransition(async () => {
      const res = await toggleEstadoUsuario(u.id, u.activo)
      if (!res.success) {
        alert(res.error || 'Error cambiando estado')
      } else {
        window.location.reload()
      }
    })
  }

  function handleResetPasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!modalPassword) return
    setPwdError(null)
    setPwdSuccess(null)
    if (newPassword.length < 6) {
      setPwdError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    startTransition(async () => {
      const res = await resetPasswordUsuarioAction(modalPassword.id, newPassword)
      if (!res.success) {
        setPwdError(res.error || 'No se pudo actualizar la contraseña')
      } else {
        setPwdSuccess(`Contraseña actualizada correctamente para ${modalPassword.nombre} ${modalPassword.apellido}`)
        setNewPassword('')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Aviso si falta correr la migración SQL 00010 */}
      {!rbacMigrationReady && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-200 flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-bold text-amber-300">
              Migración SQL pendiente: <code className="font-mono">00010_rbac_roles_permisos.sql</code>
            </p>
            <p className="text-amber-200/80 mt-0.5">
              Estás viendo los roles base en modo compatibilidad. Ejecuta el archivo{' '}
              <code className="font-mono">supabase/migrations/00010_rbac_roles_permisos.sql</code> en el SQL Editor de Supabase para habilitar la creación de roles personalizados y permisos individuales en base de datos.
            </p>
          </div>
        </div>
      )}

      {/* Header + Acción Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios, Roles y Permisos</h1>
          <p className="text-slate-400 text-sm mt-1">
            Administra cuentas, crea roles personalizados y controla permisos por proceso (Solicitud de Insumos, Solicitud de Prótesis, Farmacia y Clínica).
          </p>
        </div>

        {canManageUsers && (
          <button
            type="button"
            onClick={() =>
              setModalUsuario({ open: true, mode: 'create', tab: 'datos', usuario: null })
            }
            className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-sky-500/20 transition-all text-sm"
          >
            <span>+</span>
            <span>Nuevo Usuario</span>
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400 font-medium">Total Usuarios</p>
          <p className="text-2xl font-bold text-white mt-1">{totalUsuarios}</p>
          <p className="text-xs text-emerald-400 mt-1">{activosCount} activos</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400 font-medium">Roles Configurados</p>
          <p className="text-2xl font-bold text-sky-400 mt-1">{roles.length}</p>
          <p className="text-xs text-slate-500 mt-1">
            {rolesPersonalizados > 0
              ? `${rolesPersonalizados} personalizado(s)`
              : '7 roles base del sistema'}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400 font-medium">Permisos Granulares</p>
          <p className="text-2xl font-bold text-violet-400 mt-1">{ALL_PERMISOS.length}</p>
          <p className="text-xs text-slate-500 mt-1">En {MODULOS_RBAC.length} módulos operativos</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400 font-medium">Permisos Individuales</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{usuariosConOverrides}</p>
          <p className="text-xs text-slate-500 mt-1">Usuario(s) con excepciones</p>
        </div>
      </div>

      {/* Navegación por Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900/80 border border-slate-800 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('usuarios')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'usuarios'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>👥</span>
          <span>Usuarios ({usuarios.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'roles'
              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>🛡️</span>
          <span>Roles y Permisos ({roles.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('matriz')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'matriz'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>📊</span>
          <span>Matriz Comparativa</span>
        </button>
      </div>

      {/* TAB 1: GESTIÓN DE USUARIOS */}
      {activeTab === 'usuarios' && (
        <div className="space-y-4">
          {/* Barra de búsqueda y filtros */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, apellido, correo o rol..."
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </div>

            <select
              value={rolFilter}
              onChange={(e) => setRolFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
            >
              <option value="">Todos los roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
              {(['todos', 'activos', 'inactivos'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setEstadoFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                    estadoFilter === st
                      ? 'bg-sky-500/20 text-sky-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Tabla de Usuarios */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            {filteredUsuarios.length === 0 ? (
              <div className="px-6 py-16 text-center text-slate-500">
                <p className="text-4xl mb-3">👥</p>
                <p className="font-medium text-slate-300">No se encontraron usuarios con esos filtros</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-4 py-3.5">Usuario</th>
                      <th className="px-4 py-3.5">Rol Asignado</th>
                      <th className="px-4 py-3.5">Áreas / Farmacias / Lab</th>
                      <th className="px-4 py-3.5 text-center">Permisos</th>
                      <th className="px-4 py-3.5 text-center">Estado</th>
                      <th className="px-4 py-3.5">Registro</th>
                      {canManageUsers && <th className="px-4 py-3.5 text-right">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {filteredUsuarios.map((u) => {
                      const role = resolveUserRole(u)
                      const style = ROL_COLOR_STYLES[role?.color || 'sky'] || ROL_COLOR_STYLES.sky
                      const initials = `${u.nombre[0] || ''}${u.apellido[0] || ''}`.toUpperCase()
                      const granted = u.overrides.filter((o) => o.concedido).length
                      const revoked = u.overrides.filter((o) => !o.concedido).length
                      const isSelf = u.id === currentUserId

                      return (
                        <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 border border-slate-700 flex items-center justify-center font-bold text-xs text-sky-300 shrink-0">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <p className="text-white font-semibold truncate">
                                  {u.nombre} {u.apellido}
                                  {isSelf && (
                                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400">
                                      Tú
                                    </span>
                                  )}
                                </p>
                                <p className="text-slate-400 text-[11px] truncate">{u.email}</p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${style.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                              {role?.nombre || u.rol}
                            </span>
                            {role && !role.es_sistema && (
                              <span className="block text-[10px] text-violet-400 mt-1">
                                Rol personalizado
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 max-w-xs">
                            <div className="flex flex-wrap gap-1">
                              {u.area_ids.map((aid) => {
                                const a = areaMap.get(aid)
                                if (!a) return null
                                return (
                                  <span
                                    key={aid}
                                    className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[10px]"
                                    title={`Área: ${a.nombre}`}
                                  >
                                    🏢 {a.nombre}
                                  </span>
                                )
                              })}
                              {u.farmacia_ids.map((fid) => {
                                const f = farmMap.get(fid)
                                if (!f) return null
                                return (
                                  <span
                                    key={fid}
                                    className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px]"
                                    title={`Farmacia: ${f.nombre}`}
                                  >
                                    🏥 {f.nombre}
                                  </span>
                                )
                              })}
                              {u.laboratorio_nombre && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px]">
                                  🔬 {u.laboratorio_nombre}
                                </span>
                              )}
                              {u.area_ids.length === 0 &&
                                u.farmacia_ids.length === 0 &&
                                !u.laboratorio_nombre && (
                                  <span className="text-slate-600">—</span>
                                )}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-center">
                            {role?.codigo === 'admin' ? (
                              <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 text-[10px] font-bold">
                                Acceso Total
                              </span>
                            ) : (
                              <div className="inline-flex flex-col items-center gap-0.5">
                                <span className="text-slate-300 font-mono font-semibold">
                                  {(role?.permisos.length ?? 0) + granted - revoked} / {ALL_PERMISOS.length}
                                </span>
                                {(granted > 0 || revoked > 0) && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-semibold">
                                    {granted > 0 ? `+${granted}` : ''}
                                    {granted > 0 && revoked > 0 ? ' / ' : ''}
                                    {revoked > 0 ? `-${revoked}` : ''}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                u.activo
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {u.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-slate-500 font-mono whitespace-nowrap">
                            {format(new Date(u.created_at), 'dd/MM/yyyy', { locale: es })}
                          </td>

                          {canManageUsers && (
                            <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setModalUsuario({ open: true, mode: 'edit', tab: 'datos', usuario: u })
                                }
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-medium transition-colors"
                                title="Editar datos, rol, áreas y farmacias"
                              >
                                ✏️ Editar
                              </button>
                              {canManageRoles && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setModalUsuario({ open: true, mode: 'edit', tab: 'permisos', usuario: u })
                                  }
                                  className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 rounded-lg text-[11px] font-medium transition-colors"
                                  title="Personalizar permisos individuales"
                                >
                                  🛡️
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setPwdError(null)
                                  setPwdSuccess(null)
                                  setNewPassword('')
                                  setModalPassword(u)
                                }}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg text-[11px] transition-colors"
                                title="Restablecer contraseña"
                              >
                                🔑
                              </button>
                              {!isSelf && (
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => handleToggleEstado(u)}
                                  className={`px-2 py-1 rounded-lg text-[11px] transition-colors ${
                                    u.activo
                                      ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400'
                                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                                  }`}
                                  title={u.activo ? 'Desactivar usuario' : 'Reactivar usuario'}
                                >
                                  {u.activo ? '⏻' : '✓'}
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ROLES Y PERMISOS */}
      {activeTab === 'roles' && (
        <RolesManagerPanel
          roles={roles}
          canManageRoles={canManageRoles && rbacMigrationReady}
          onRefresh={() => window.location.reload()}
        />
      )}

      {/* TAB 3: MATRIZ COMPARATIVA DE AUDITORÍA */}
      {activeTab === 'matriz' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Matriz Comparativa de Permisos × Roles</h3>
              <p className="text-xs text-slate-400">
                Audita rápidamente qué roles tienen acceso a cada función crítica del sistema.
              </p>
            </div>
            <select
              value={matrizModFilter}
              onChange={(e) => setMatrizModFilter(e.target.value as ModuloCodigo | 'todos')}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
            >
              <option value="todos">Todos los módulos ({ALL_PERMISOS.length} permisos)</option>
              {MODULOS_RBAC.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.icono} {m.titulo}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 sticky left-0 bg-slate-950 z-10 min-w-[260px]">
                      Módulo / Permiso
                    </th>
                    {roles.map((r) => {
                      const st = ROL_COLOR_STYLES[r.color] || ROL_COLOR_STYLES.sky
                      return (
                        <th key={r.id} className="px-3 py-3 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${st.badge}`}>
                            {r.nombre}
                          </span>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {MODULOS_RBAC.filter(
                    (m) => matrizModFilter === 'todos' || m.codigo === matrizModFilter
                  ).map((mod) => {
                    const modPerms = PERMISOS_CATALOGO.filter((p) => p.modulo === mod.codigo)
                    return [
                      <tr key={`mod-${mod.codigo}`} className="bg-slate-950/70">
                        <td
                          colSpan={roles.length + 1}
                          className="px-4 py-2 font-bold text-slate-200 uppercase tracking-wider text-[11px]"
                        >
                          {mod.icono} {mod.titulo}
                        </td>
                      </tr>,
                      ...modPerms.map((p) => (
                        <tr key={p.codigo} className="hover:bg-slate-800/30">
                          <td className="px-4 py-2.5 sticky left-0 bg-slate-900/95">
                            <p className="text-slate-200 font-medium">{p.nombre}</p>
                            <p className="text-[10px] text-slate-500 font-mono">{p.codigo}</p>
                          </td>
                          {roles.map((r) => {
                            const has = r.codigo === 'admin' || r.permisos.includes(p.codigo)
                            return (
                              <td key={r.id} className="px-3 py-2.5 text-center">
                                {has ? (
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-500/15 text-emerald-400 font-bold">
                                    ✓
                                  </span>
                                ) : (
                                  <span className="text-slate-700">—</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )),
                    ]
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR USUARIO */}
      {modalUsuario.open && (
        <ModalUsuarioEditor
          mode={modalUsuario.mode}
          initialTab={modalUsuario.tab}
          usuario={modalUsuario.usuario}
          roles={roles}
          areas={areas}
          farmacias={farmacias}
          laboratorios={laboratorios}
          currentUserId={currentUserId}
          canManageRoles={canManageRoles && rbacMigrationReady}
          onClose={() => setModalUsuario({ ...modalUsuario, open: false })}
          onSaved={() => {
            setModalUsuario({ ...modalUsuario, open: false })
            window.location.reload()
          }}
        />
      )}

      {/* MODAL RESTABLECER CONTRASEÑA */}
      {modalPassword && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🔑</span>
                  <span>Restablecer Contraseña</span>
                </h3>
                <p className="text-xs text-sky-400 mt-0.5">
                  {modalPassword.nombre} {modalPassword.apellido} ({modalPassword.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalPassword(null)}
                className="text-slate-500 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {pwdError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
                ⚠️ {pwdError}
              </div>
            )}
            {pwdSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl">
                ✅ {pwdSuccess}
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nueva Contraseña <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalPassword(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
                >
                  {isPending ? 'Actualizando...' : 'Actualizar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
