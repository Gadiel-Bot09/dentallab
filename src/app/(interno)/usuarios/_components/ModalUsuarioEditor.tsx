'use client'
// src/app/(interno)/usuarios/_components/ModalUsuarioEditor.tsx
import { useState, useMemo, useTransition } from 'react'
import {
  ALL_PERMISOS,
  MODULOS_RBAC,
  PERMISOS_CATALOGO,
  ROL_COLOR_STYLES,
  computeEffectivePermissions,
  type PermisoCodigo,
  type RolConPermisos,
  type UsuarioPermisoOverride,
} from '@/lib/rbac'
import { actualizarUsuarioAction, crearUsuarioAction } from '../actions'

export interface UsuarioRowData {
  id: string
  nombre: string
  apellido: string
  email: string
  rol: string
  rol_id: string | null
  activo: boolean
  laboratorio_id: string | null
  laboratorio_nombre: string | null
  created_at: string
  area_ids: string[]
  farmacia_ids: string[]
  overrides: UsuarioPermisoOverride[]
}

interface Props {
  mode: 'create' | 'edit'
  initialTab?: 'datos' | 'alcance' | 'permisos'
  usuario?: UsuarioRowData | null
  roles: RolConPermisos[]
  areas: { id: string; codigo: string; nombre: string }[]
  farmacias: { id: string; codigo: string; nombre: string }[]
  laboratorios: { id: string; nombre: string }[]
  currentUserId: string
  canManageRoles: boolean
  onClose: () => void
  onSaved: () => void
}

export default function ModalUsuarioEditor({
  mode,
  initialTab = 'datos',
  usuario,
  roles,
  areas,
  farmacias,
  laboratorios,
  currentUserId,
  canManageRoles,
  onClose,
  onSaved,
}: Props) {
  const [tab, setTab] = useState<'datos' | 'alcance' | 'permisos'>(initialTab)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Resolver rol inicial
  const initialRole = useMemo(() => {
    if (usuario?.rol_id) {
      const byId = roles.find((r) => r.id === usuario.rol_id)
      if (byId) return byId
    }
    if (usuario?.rol) {
      const byCode = roles.find((r) => r.codigo === usuario.rol)
      if (byCode) return byCode
    }
    return roles.find((r) => r.codigo === 'auxiliar') || roles[0] || null
  }, [usuario, roles])

  // Estado formulario
  const [nombre, setNombre] = useState(usuario?.nombre || '')
  const [apellido, setApellido] = useState(usuario?.apellido || '')
  const [email, setEmail] = useState(usuario?.email || '')
  const [password, setPassword] = useState('')
  const [activo, setActivo] = useState(usuario ? usuario.activo : true)
  const [selectedRolId, setSelectedRolId] = useState<string>(initialRole?.id || '')
  const [laboratorioId, setLaboratorioId] = useState<string>(usuario?.laboratorio_id || '')
  const [areaIds, setAreaIds] = useState<string[]>(usuario?.area_ids || [])
  const [farmaciaIds, setFarmaciaIds] = useState<string[]>(usuario?.farmacia_ids || [])
  const [overrides, setOverrides] = useState<UsuarioPermisoOverride[]>(usuario?.overrides || [])
  const [permSearch, setPermSearch] = useState('')

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRolId) || null,
    [roles, selectedRolId]
  )

  const roleIsAdmin = selectedRole?.codigo === 'admin' || selectedRole?.rol_base === 'admin'
  const requiresLab =
    selectedRole?.rol_base === 'laboratorio' || selectedRole?.rol_base === 'odontologo'

  const rolePermSet = useMemo(
    () => new Set<PermisoCodigo>(roleIsAdmin ? ALL_PERMISOS : selectedRole?.permisos || []),
    [selectedRole, roleIsAdmin]
  )

  const overrideMap = useMemo(() => {
    const m = new Map<PermisoCodigo, boolean>()
    overrides.forEach((o) => m.set(o.permiso_codigo, o.concedido))
    return m
  }, [overrides])

  const effectivePerms = useMemo(
    () => computeEffectivePermissions(selectedRole?.permisos || [], overrides, roleIsAdmin),
    [selectedRole, overrides, roleIsAdmin]
  )

  function setOverrideState(codigo: PermisoCodigo, state: 'inherit' | 'allow' | 'deny') {
    setOverrides((prev) => {
      const filtered = prev.filter((o) => o.permiso_codigo !== codigo)
      if (state === 'inherit') return filtered
      const desired = state === 'allow'
      // Si coincide con lo que ya hereda el rol, no hace falta guardar override redundante
      if (rolePermSet.has(codigo) === desired) return filtered
      return [...filtered, { permiso_codigo: codigo, concedido: desired }]
    })
  }

  function toggleId(list: string[], id: string, setter: (v: string[]) => void) {
    if (list.includes(id)) setter(list.filter((x) => x !== id))
    else setter([...list, id])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!nombre.trim() || !apellido.trim() || !email.trim()) {
      setError('Nombre, apellido y correo electrónico son obligatorios')
      setTab('datos')
      return
    }
    if (mode === 'create' && password.length < 6) {
      setError('La contraseña inicial debe tener al menos 6 caracteres')
      setTab('datos')
      return
    }
    if (requiresLab && !laboratorioId) {
      setError('Este rol requiere seleccionar un laboratorio o clínica asociada')
      setTab('datos')
      return
    }

    startTransition(async () => {
      const res =
        mode === 'create'
          ? await crearUsuarioAction({
              nombre: nombre.trim(),
              apellido: apellido.trim(),
              email: email.trim(),
              password,
              rol_id: selectedRolId || null,
              rol_base: selectedRole?.rol_base || 'auxiliar',
              laboratorio_id: laboratorioId || null,
              area_ids: areaIds,
              farmacia_ids: farmaciaIds,
              overrides: roleIsAdmin ? [] : overrides,
            })
          : await actualizarUsuarioAction({
              id: usuario!.id,
              nombre: nombre.trim(),
              apellido: apellido.trim(),
              email: email.trim(),
              activo,
              rol_id: selectedRolId || null,
              rol_base: selectedRole?.rol_base || 'auxiliar',
              laboratorio_id: laboratorioId || null,
              area_ids: areaIds,
              farmacia_ids: farmaciaIds,
              overrides: roleIsAdmin ? [] : overrides,
            })

      if (!res.success) {
        setError(res.error || 'Ocurrió un error al guardar el usuario')
      } else {
        onSaved()
      }
    })
  }

  const isSelf = mode === 'edit' && usuario?.id === currentUserId
  const extraGranted = overrides.filter((o) => o.concedido).length
  const extraRevoked = overrides.filter((o) => !o.concedido).length

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>{mode === 'create' ? '👤' : '✏️'}</span>
              <span>
                {mode === 'create'
                  ? 'Registrar Nuevo Usuario'
                  : `Editar Usuario: ${usuario?.nombre} ${usuario?.apellido}`}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Configura su rol, áreas/farmacias de operación y permisos personalizados sobre cada proceso.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Sub-navegación de pestañas */}
        <div className="px-6 pt-3 border-b border-slate-800 flex items-center gap-2 shrink-0 bg-slate-950/50">
          <button
            type="button"
            onClick={() => setTab('datos')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors ${
              tab === 'datos'
                ? 'border-sky-400 text-sky-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            1. Datos y Rol
          </button>
          <button
            type="button"
            onClick={() => setTab('alcance')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === 'alcance'
                ? 'border-emerald-400 text-emerald-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>2. Áreas y Farmacias</span>
            {(areaIds.length > 0 || farmaciaIds.length > 0) && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                {areaIds.length + farmaciaIds.length}
              </span>
            )}
          </button>
          {canManageRoles && (
            <button
              type="button"
              onClick={() => setTab('permisos')}
              className={`px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === 'permisos'
                  ? 'border-amber-400 text-amber-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <span>3. Permisos Individuales</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                {effectivePerms.length}/{ALL_PERMISOS.length}
              </span>
              {(extraGranted > 0 || extraRevoked > 0) && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                  {extraGranted > 0 ? `+${extraGranted}` : ''}
                  {extraGranted > 0 && extraRevoked > 0 ? ' / ' : ''}
                  {extraRevoked > 0 ? `-${extraRevoked}` : ''}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Cuerpo */}
        <form id="form-usuario-editor" onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl">
              ⚠️ {error}
            </div>
          )}

          {/* TAB 1: DATOS Y ROL */}
          {tab === 'datos' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nombre <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: María"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Apellido <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    placeholder="Ej: Gómez"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Correo Electrónico (Login) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@clinica.com"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  />
                </div>

                {mode === 'create' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Contraseña Inicial <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    />
                  </div>
                ) : (
                  <div className="flex items-end pb-2">
                    <label className="inline-flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activo}
                        disabled={isSelf}
                        onChange={(e) => setActivo(e.target.checked)}
                        className="rounded border-slate-600 bg-slate-900 text-emerald-500 w-4 h-4"
                      />
                      <span>
                        Cuenta activa{' '}
                        {isSelf && <span className="text-xs text-slate-500">(tu sesión actual)</span>}
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Selector Visual de Rol */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Rol Asignado (Sistema o Personalizado) <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {roles.map((r) => {
                    const isSelected = r.id === selectedRolId
                    const style = ROL_COLOR_STYLES[r.color] || ROL_COLOR_STYLES.sky
                    const disableSelfDemote = isSelf && usuario?.rol === 'admin' && r.rol_base !== 'admin'
                    return (
                      <button
                        key={r.id}
                        type="button"
                        disabled={disableSelfDemote}
                        onClick={() => setSelectedRolId(r.id)}
                        className={`p-3 rounded-xl border text-left transition-all disabled:opacity-40 ${
                          isSelected
                            ? 'bg-sky-500/10 border-sky-500 ring-1 ring-sky-500/40'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${style.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                            {r.nombre}
                          </span>
                          {!r.es_sistema && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 font-semibold">
                              Propio
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2">
                          {r.descripcion || 'Rol personalizado'}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1.5 font-mono">
                          {r.codigo === 'admin' ? ALL_PERMISOS.length : r.permisos.length} permiso(s) · inicio: {r.home_path}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Laboratorio / Clínica si aplica */}
              {requiresLab && (
                <div className="p-4 bg-indigo-950/20 border border-indigo-500/30 rounded-xl space-y-2">
                  <label className="block text-xs font-semibold text-indigo-300">
                    Clínica / Laboratorio Asociado <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={laboratorioId}
                    onChange={(e) => setLaboratorioId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white"
                  >
                    <option value="">-- Seleccionar clínica o laboratorio --</option>
                    {laboratorios.map((l) => (
                      <option key={l.id} value={l.id}>{l.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ÁREAS Y FARMACIAS */}
          {tab === 'alcance' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Áreas Institucionales */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
                    <span>🏢</span>
                    <span>Áreas Institucionales ({areaIds.length})</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    El usuario podrá solicitar insumos, confirmar recepciones y gestionar devoluciones para las áreas marcadas.
                  </p>
                </div>

                {areas.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No hay áreas registradas aún.</p>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {areas.map((a) => {
                      const checked = areaIds.includes(a.id)
                      return (
                        <label
                          key={a.id}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            checked
                              ? 'bg-sky-500/10 border-sky-500/40 text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleId(areaIds, a.id, setAreaIds)}
                            className="rounded border-slate-600 bg-slate-900 text-sky-500"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate">{a.nombre}</p>
                            <p className="text-[10px] font-mono text-slate-500">{a.codigo}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Farmacias / Bodegas */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                    <span>🏥</span>
                    <span>Farmacias / Bodegas ({farmaciaIds.length})</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    El usuario podrá despachar pedidos, registrar compras/recepciones técnicas y confirmar devoluciones en estas sedes.
                  </p>
                </div>

                {farmacias.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No hay farmacias registradas aún.</p>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {farmacias.map((f) => {
                      const checked = farmaciaIds.includes(f.id)
                      return (
                        <label
                          key={f.id}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            checked
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleId(farmaciaIds, f.id, setFarmaciaIds)}
                            className="rounded border-slate-600 bg-slate-900 text-emerald-500"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate">{f.nombre}</p>
                            <p className="text-[10px] font-mono text-slate-500">{f.codigo}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PERMISOS PERSONALIZADOS POR USUARIO */}
          {tab === 'permisos' && (
            <div className="space-y-4">
              {roleIsAdmin ? (
                <div className="p-6 bg-sky-500/10 border border-sky-500/30 rounded-xl text-center space-y-1">
                  <p className="text-2xl">🛡️</p>
                  <p className="text-sm font-bold text-sky-300">Acceso Total (Administrador)</p>
                  <p className="text-xs text-slate-400">
                    Este usuario tiene el rol Administrador y dispone automáticamente de todos los permisos del sistema.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-300">
                      Rol base: <strong className="text-sky-400">{selectedRole?.nombre}</strong> ·{' '}
                      <span className="text-slate-400">
                        Usa <strong>Conceder (+)</strong> o <strong>Revocar (-)</strong> para personalizar permisos puntuales solo para este usuario.
                      </span>
                    </div>
                    {overrides.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setOverrides([])}
                        className="text-xs text-amber-400 hover:text-amber-300 font-semibold shrink-0"
                      >
                        Restablecer a rol ({overrides.length})
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                    placeholder="Filtrar permisos (ej: despachar, prótesis, odontograma, lotes, reportes)..."
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500"
                  />

                  <div className="space-y-3">
                    {MODULOS_RBAC.map((mod) => {
                      const perms = PERMISOS_CATALOGO.filter(
                        (p) =>
                          p.modulo === mod.codigo &&
                          (!permSearch.trim() ||
                            p.nombre.toLowerCase().includes(permSearch.toLowerCase()) ||
                            p.descripcion.toLowerCase().includes(permSearch.toLowerCase()) ||
                            p.codigo.toLowerCase().includes(permSearch.toLowerCase()))
                      )
                      if (perms.length === 0) return null

                      return (
                        <div key={mod.codigo} className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden">
                          <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center gap-2">
                            <span>{mod.icono}</span>
                            <span className="text-xs font-bold text-white">{mod.titulo}</span>
                          </div>
                          <div className="divide-y divide-slate-800/50">
                            {perms.map((p) => {
                              const inherited = rolePermSet.has(p.codigo)
                              const hasOv = overrideMap.has(p.codigo)
                              const ovVal = overrideMap.get(p.codigo)
                              const currentMode: 'inherit' | 'allow' | 'deny' = !hasOv
                                ? 'inherit'
                                : ovVal
                                ? 'allow'
                                : 'deny'
                              const effective = hasOv ? Boolean(ovVal) : inherited

                              return (
                                <div
                                  key={p.codigo}
                                  className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-900/40"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${
                                          effective ? 'bg-emerald-400' : 'bg-slate-600'
                                        }`}
                                      />
                                      <p className="text-xs font-medium text-white">{p.nombre}</p>
                                      {hasOv && (
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                            ovVal
                                              ? 'bg-emerald-500/20 text-emerald-300'
                                              : 'bg-red-500/20 text-red-300'
                                          }`}
                                        >
                                          {ovVal ? '+ Excepción' : '− Revocado'}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 pl-4">{p.descripcion}</p>
                                  </div>

                                  <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 shrink-0 self-end sm:self-center">
                                    <button
                                      type="button"
                                      onClick={() => setOverrideState(p.codigo, 'inherit')}
                                      className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                                        currentMode === 'inherit'
                                          ? 'bg-slate-700 text-white'
                                          : 'text-slate-500 hover:text-slate-300'
                                      }`}
                                    >
                                      Rol ({inherited ? 'Sí' : 'No'})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setOverrideState(p.codigo, 'allow')}
                                      className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                                        currentMode === 'allow'
                                          ? 'bg-emerald-600 text-white'
                                          : 'text-slate-500 hover:text-emerald-400'
                                      }`}
                                    >
                                      + Conceder
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setOverrideState(p.codigo, 'deny')}
                                      className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                                        currentMode === 'deny'
                                          ? 'bg-red-600 text-white'
                                          : 'text-slate-500 hover:text-red-400'
                                      }`}
                                    >
                                      − Revocar
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 rounded-b-2xl flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            Permisos efectivos:{' '}
            <strong className="text-sky-400">{effectivePerms.length}</strong> / {ALL_PERMISOS.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-usuario-editor"
              disabled={isPending}
              className="px-5 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-sky-500/20"
            >
              {isPending
                ? 'Guardando...'
                : mode === 'create'
                ? 'Crear Usuario'
                : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
