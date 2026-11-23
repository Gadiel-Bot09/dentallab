// src/lib/rbac-server.ts
// Resolución de roles y permisos efectivos del usuario autenticado en el servidor.
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { ROL_LABELS, type UserRol } from '@/types/database'
import {
  ALL_PERMISOS,
  DEFAULT_ROLE_PERMISSIONS,
  computeEffectivePermissions,
  type PermisoCodigo,
  type RolColor,
  type UsuarioPermisoOverride,
} from '@/lib/rbac'

export interface UserAuthContext {
  userId: string
  email: string
  nombre: string
  apellido: string
  rol: UserRol
  rolId: string | null
  rolNombre: string
  rolColor: RolColor
  homePath: string
  laboratorioId: string | null
  activo: boolean
  isAdmin: boolean
  permisos: PermisoCodigo[]
  can: (permiso: PermisoCodigo) => boolean
  canAny: (permisos: PermisoCodigo[]) => boolean
}

export async function getUserAuthContext(): Promise<UserAuthContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = await createAdminClient()

  // Consultar perfil básico (usando * para compatibilidad antes/después de migración 00010)
  const { data: profile } = await admin
    .from('usuarios')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  const baseRol = profile.rol as UserRol
  const isAdmin = baseRol === 'admin'

  let rolId: string | null = profile.rol_id ?? null
  let rolNombre: string = ROL_LABELS[baseRol] || baseRol
  let rolColor: RolColor = isAdmin ? 'sky' : 'slate'
  let homePath =
    baseRol === 'laboratorio'
      ? '/externo/ordenes'
      : baseRol === 'farmacia' || baseRol === 'jefe_area'
      ? '/solicitudes'
      : '/dashboard'

  let effectivePermisos: PermisoCodigo[] = isAdmin
    ? [...ALL_PERMISOS]
    : [...(DEFAULT_ROLE_PERMISSIONS[baseRol] || [])]

  // Intentar cargar RBAC dinámico desde tablas `roles`, `rol_permisos` y `usuario_permisos`
  try {
    let roleRow: any = null
    if (rolId) {
      const { data } = await admin.from('roles').select('*').eq('id', rolId).maybeSingle()
      roleRow = data
    }
    if (!roleRow) {
      const { data } = await admin.from('roles').select('*').eq('codigo', baseRol).maybeSingle()
      roleRow = data
    }

    if (roleRow) {
      rolId = roleRow.id
      rolNombre = roleRow.nombre || rolNombre
      rolColor = (roleRow.color as RolColor) || rolColor
      homePath = roleRow.home_path || homePath

      const roleIsAdmin = isAdmin || roleRow.codigo === 'admin' || roleRow.rol_base === 'admin'

      if (roleIsAdmin) {
        effectivePermisos = [...ALL_PERMISOS]
      } else {
        const [{ data: rpData }, { data: upData }] = await Promise.all([
          admin.from('rol_permisos').select('permiso_codigo').eq('rol_id', roleRow.id),
          admin.from('usuario_permisos').select('permiso_codigo, concedido').eq('usuario_id', user.id),
        ])

        const rolePerms = (rpData || []).map((r: any) => r.permiso_codigo as PermisoCodigo)
        const overrides = (upData || []) as UsuarioPermisoOverride[]
        effectivePermisos = computeEffectivePermissions(rolePerms, overrides, false)
      }
    }
  } catch {
    // Si la migración 00010 aún no se ha aplicado, continuamos con los permisos por defecto del rol base
  }

  const permSet = new Set<PermisoCodigo>(effectivePermisos)

  return {
    userId: profile.id,
    email: profile.email,
    nombre: profile.nombre,
    apellido: profile.apellido,
    rol: baseRol,
    rolId,
    rolNombre,
    rolColor,
    homePath,
    laboratorioId: profile.laboratorio_id ?? null,
    activo: Boolean(profile.activo),
    isAdmin,
    permisos: effectivePermisos,
    can: (p: PermisoCodigo) => isAdmin || permSet.has(p),
    canAny: (ps: PermisoCodigo[]) => isAdmin || ps.some((p) => permSet.has(p)),
  }
}
