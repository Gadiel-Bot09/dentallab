'use server'
// src/app/(interno)/usuarios/actions.ts
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { registrarAuditLog } from '@/lib/audit/logger'
import { getUserAuthContext } from '@/lib/rbac-server'
import {
  ALL_PERMISOS,
  type PermisoCodigo,
  type RolColor,
  type UsuarioPermisoOverride,
} from '@/lib/rbac'
import type { UserRol } from '@/types/database'

const VALID_PERMISOS_SET = new Set<string>(ALL_PERMISOS)
const VALID_BASE_ROLES: UserRol[] = [
  'admin',
  'odontologo',
  'auxiliar',
  'recepcionista',
  'laboratorio',
  'farmacia',
  'jefe_area',
]

function slugifyRoleCode(nombre: string) {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

export interface CrearUsuarioInput {
  nombre: string
  apellido: string
  email: string
  password: string
  rol_id?: string | null
  rol_base?: UserRol
  laboratorio_id?: string | null
  area_ids?: string[]
  farmacia_ids?: string[]
  overrides?: UsuarioPermisoOverride[]
}

export interface ActualizarUsuarioInput {
  id: string
  nombre: string
  apellido: string
  email: string
  activo: boolean
  rol_id?: string | null
  rol_base?: UserRol
  laboratorio_id?: string | null
  area_ids: string[]
  farmacia_ids: string[]
  overrides: UsuarioPermisoOverride[]
}

// ─── CREAR USUARIO ───────────────────────────────────────────────────────────
export async function crearUsuarioAction(input: CrearUsuarioInput) {
  try {
    const ctx = await getUserAuthContext()
    if (!ctx || !ctx.can('usuarios.gestionar')) {
      return { success: false, error: 'No tiene permiso para crear usuarios' }
    }

    const nombre = input.nombre?.trim()
    const apellido = input.apellido?.trim()
    const email = input.email?.trim().toLowerCase()
    const password = input.password || ''

    if (!nombre || nombre.length < 2) return { success: false, error: 'El nombre es obligatorio (mín. 2 caracteres)' }
    if (!apellido || apellido.length < 2) return { success: false, error: 'El apellido es obligatorio (mín. 2 caracteres)' }
    if (!email || !email.includes('@')) return { success: false, error: 'Correo electrónico inválido' }
    if (password.length < 6) return { success: false, error: 'La contraseña debe tener al menos 6 caracteres' }

    const admin = await createAdminClient()

    // Resolver rol personalizado o base
    let resolvedRolBase: UserRol = input.rol_base || 'auxiliar'
    let resolvedRolId: string | null = input.rol_id || null

    if (resolvedRolId) {
      const { data: roleRow } = await admin
        .from('roles')
        .select('id, rol_base, codigo')
        .eq('id', resolvedRolId)
        .maybeSingle()
      if (!roleRow) return { success: false, error: 'El rol seleccionado no existe' }
      resolvedRolBase = roleRow.rol_base as UserRol
    } else if (VALID_BASE_ROLES.includes(resolvedRolBase)) {
      const { data: roleRow } = await admin
        .from('roles')
        .select('id')
        .eq('codigo', resolvedRolBase)
        .maybeSingle()
      if (roleRow) resolvedRolId = roleRow.id
    }

    // 1. Crear en Supabase Auth
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      return { success: false, error: authError?.message || 'No se pudo crear el usuario en Auth' }
    }

    const newUserId = authData.user.id

    // 2. Insertar en tabla `usuarios`
    const insertPayload: Record<string, any> = {
      id: newUserId,
      email,
      nombre,
      apellido,
      rol: resolvedRolBase,
      laboratorio_id: input.laboratorio_id || null,
      activo: true,
    }
    if (resolvedRolId) insertPayload.rol_id = resolvedRolId

    const { error: dbError } = await admin.from('usuarios').insert(insertPayload)
    if (dbError) {
      await admin.auth.admin.deleteUser(newUserId)
      return { success: false, error: dbError.message }
    }

    // 3. Asignar áreas institucionales
    const areaIds = Array.from(new Set((input.area_ids || []).filter(Boolean)))
    if (areaIds.length > 0) {
      await admin.from('usuario_areas').insert(
        areaIds.map((area_id) => ({ usuario_id: newUserId, area_id }))
      )
    }

    // 4. Asignar farmacias / bodegas
    const farmaciaIds = Array.from(new Set((input.farmacia_ids || []).filter(Boolean)))
    if (farmaciaIds.length > 0) {
      await admin.from('usuario_farmacias').insert(
        farmaciaIds.map((farmacia_id) => ({ usuario_id: newUserId, farmacia_id }))
      )
    }

    // 5. Guardar permisos individuales (overrides) si se definieron
    const validOverrides = (input.overrides || []).filter((o) =>
      VALID_PERMISOS_SET.has(o.permiso_codigo)
    )
    if (validOverrides.length > 0) {
      await admin.from('usuario_permisos').insert(
        validOverrides.map((o) => ({
          usuario_id: newUserId,
          permiso_codigo: o.permiso_codigo,
          concedido: Boolean(o.concedido),
        }))
      )
    }

    await registrarAuditLog({
      usuario_id: ctx.userId,
      rol: ctx.rol,
      accion: 'usuario.crear',
      entidad: 'usuarios',
      entidad_id: newUserId,
      metadata: {
        email,
        rol: resolvedRolBase,
        rol_id: resolvedRolId,
        areas: areaIds.length,
        farmacias: farmaciaIds.length,
        overrides: validOverrides.length,
      },
    })

    revalidatePath('/usuarios')
    return { success: true, id: newUserId }
  } catch (error: any) {
    console.error('[CREAR_USUARIO_ERROR]', error)
    return { success: false, error: error?.message || 'Error al crear usuario' }
  }
}

// Compatibilidad con formulario antiguo basado en FormData
export async function crearUsuario(formData: FormData) {
  return crearUsuarioAction({
    nombre: String(formData.get('nombre') || ''),
    apellido: String(formData.get('apellido') || ''),
    email: String(formData.get('email') || ''),
    password: String(formData.get('password') || ''),
    rol_id: (formData.get('rol_id') as string) || null,
    rol_base: ((formData.get('rol') as UserRol) || 'auxiliar'),
    laboratorio_id: (formData.get('laboratorio_id') as string) || null,
    area_ids: formData.getAll('area_ids').map(String).filter(Boolean),
    farmacia_ids: formData.getAll('farmacia_ids').map(String).filter(Boolean),
  })
}

// ─── ACTUALIZAR USUARIO (PERFIL, ROL, ÁREAS, FARMACIAS Y OVERRIDES) ──────────
export async function actualizarUsuarioAction(input: ActualizarUsuarioInput) {
  try {
    const ctx = await getUserAuthContext()
    if (!ctx || !ctx.can('usuarios.gestionar')) {
      return { success: false, error: 'No tiene permiso para editar usuarios' }
    }

    const nombre = input.nombre?.trim()
    const apellido = input.apellido?.trim()
    const email = input.email?.trim().toLowerCase()

    if (!input.id) return { success: false, error: 'ID de usuario inválido' }
    if (!nombre || nombre.length < 2) return { success: false, error: 'El nombre es obligatorio' }
    if (!apellido || apellido.length < 2) return { success: false, error: 'El apellido es obligatorio' }
    if (!email || !email.includes('@')) return { success: false, error: 'Correo electrónico inválido' }

    if (input.id === ctx.userId && !input.activo) {
      return { success: false, error: 'No puedes desactivar tu propia cuenta de usuario' }
    }

    const admin = await createAdminClient()

    const { data: current } = await admin
      .from('usuarios')
      .select('id, email, rol, rol_id')
      .eq('id', input.id)
      .single()

    if (!current) return { success: false, error: 'Usuario no encontrado' }

    // Resolver rol destino
    let resolvedRolBase: UserRol = input.rol_base || (current.rol as UserRol)
    let resolvedRolId: string | null = input.rol_id || null

    if (resolvedRolId) {
      const { data: roleRow } = await admin
        .from('roles')
        .select('id, rol_base')
        .eq('id', resolvedRolId)
        .maybeSingle()
      if (!roleRow) return { success: false, error: 'El rol seleccionado no existe' }
      resolvedRolBase = roleRow.rol_base as UserRol
    }

    if (input.id === ctx.userId && current.rol === 'admin' && resolvedRolBase !== 'admin') {
      return { success: false, error: 'No puedes quitarte el rol Administrador a ti mismo' }
    }

    // Actualizar email en Supabase Auth si cambió
    if (email !== current.email.toLowerCase()) {
      const { error: authErr } = await admin.auth.admin.updateUserById(input.id, {
        email,
        email_confirm: true,
      })
      if (authErr) return { success: false, error: `Error actualizando correo en Auth: ${authErr.message}` }
    }

    const updatePayload: Record<string, any> = {
      nombre,
      apellido,
      email,
      activo: Boolean(input.activo),
      rol: resolvedRolBase,
      laboratorio_id: input.laboratorio_id || null,
      updated_at: new Date().toISOString(),
    }
    if (resolvedRolId) updatePayload.rol_id = resolvedRolId

    const { error: updErr } = await admin
      .from('usuarios')
      .update(updatePayload)
      .eq('id', input.id)

    if (updErr) return { success: false, error: updErr.message }

    // Sincronizar áreas
    await admin.from('usuario_areas').delete().eq('usuario_id', input.id)
    const areaIds = Array.from(new Set((input.area_ids || []).filter(Boolean)))
    if (areaIds.length > 0) {
      await admin.from('usuario_areas').insert(
        areaIds.map((area_id) => ({ usuario_id: input.id, area_id }))
      )
    }

    // Sincronizar farmacias
    await admin.from('usuario_farmacias').delete().eq('usuario_id', input.id)
    const farmaciaIds = Array.from(new Set((input.farmacia_ids || []).filter(Boolean)))
    if (farmaciaIds.length > 0) {
      await admin.from('usuario_farmacias').insert(
        farmaciaIds.map((farmacia_id) => ({ usuario_id: input.id, farmacia_id }))
      )
    }

    // Sincronizar permisos individuales (overrides)
    const validOverrides = (input.overrides || []).filter((o) =>
      VALID_PERMISOS_SET.has(o.permiso_codigo)
    )
    const { error: delPermErr } = await admin
      .from('usuario_permisos')
      .delete()
      .eq('usuario_id', input.id)

    if (!delPermErr && validOverrides.length > 0) {
      await admin.from('usuario_permisos').insert(
        validOverrides.map((o) => ({
          usuario_id: input.id,
          permiso_codigo: o.permiso_codigo,
          concedido: Boolean(o.concedido),
        }))
      )
    }

    await registrarAuditLog({
      usuario_id: ctx.userId,
      rol: ctx.rol,
      accion: 'usuario.actualizar',
      entidad: 'usuarios',
      entidad_id: input.id,
      metadata: {
        email,
        rol: resolvedRolBase,
        rol_id: resolvedRolId,
        activo: input.activo,
        areas: areaIds.length,
        farmacias: farmaciaIds.length,
        overrides: validOverrides.length,
      },
    })

    revalidatePath('/usuarios')
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error: any) {
    console.error('[ACTUALIZAR_USUARIO_ERROR]', error)
    return { success: false, error: error?.message || 'Error al actualizar usuario' }
  }
}

// ─── ACTIVAR / DESACTIVAR USUARIO ────────────────────────────────────────────
export async function toggleEstadoUsuario(id: string, estadoActual: boolean) {
  try {
    const ctx = await getUserAuthContext()
    if (!ctx || !ctx.can('usuarios.gestionar')) {
      return { success: false, error: 'No tiene permiso para cambiar el estado de usuarios' }
    }
    if (id === ctx.userId && estadoActual) {
      return { success: false, error: 'No puedes desactivar tu propia cuenta' }
    }

    const admin = await createAdminClient()
    const { error } = await admin
      .from('usuarios')
      .update({ activo: !estadoActual, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return { success: false, error: error.message }

    await registrarAuditLog({
      usuario_id: ctx.userId,
      rol: ctx.rol,
      accion: estadoActual ? 'usuario.desactivar' : 'usuario.activar',
      entidad: 'usuarios',
      entidad_id: id,
    })

    revalidatePath('/usuarios')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Error cambiando estado' }
  }
}

// ─── RESTABLECER CONTRASEÑA ──────────────────────────────────────────────────
export async function resetPasswordUsuarioAction(userId: string, newPassword: string) {
  try {
    const ctx = await getUserAuthContext()
    if (!ctx || !ctx.can('usuarios.gestionar')) {
      return { success: false, error: 'No tiene permiso para restablecer contraseñas' }
    }
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'La nueva contraseña debe tener al menos 6 caracteres' }
    }

    const admin = await createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (error) return { success: false, error: error.message }

    await registrarAuditLog({
      usuario_id: ctx.userId,
      rol: ctx.rol,
      accion: 'usuario.reset_password',
      entidad: 'usuarios',
      entidad_id: userId,
    })

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Error al restablecer contraseña' }
  }
}

// ─── CREAR ROL PERSONALIZADO ─────────────────────────────────────────────────
export async function crearRolAction(input: {
  nombre: string
  descripcion?: string
  color: RolColor
  rol_base: UserRol
  home_path: string
  permisos: PermisoCodigo[]
}) {
  try {
    const ctx = await getUserAuthContext()
    if (!ctx || !ctx.can('roles.gestionar')) {
      return { success: false, error: 'No tiene permiso para crear roles' }
    }

    const nombre = input.nombre?.trim()
    if (!nombre || nombre.length < 2) {
      return { success: false, error: 'El nombre del rol es obligatorio (mín. 2 caracteres)' }
    }

    const codigo = slugifyRoleCode(nombre)
    if (!codigo) return { success: false, error: 'Nombre de rol inválido' }

    const rolBase: UserRol = VALID_BASE_ROLES.includes(input.rol_base) ? input.rol_base : 'auxiliar'
    const admin = await createAdminClient()

    const { data: created, error } = await admin
      .from('roles')
      .insert({
        codigo,
        nombre,
        descripcion: input.descripcion?.trim() || null,
        color: input.color || 'sky',
        es_sistema: false,
        rol_base: rolBase,
        home_path: input.home_path || '/dashboard',
        activo: true,
      })
      .select('*')
      .single()

    if (error || !created) {
      if (error?.code === '23505') {
        return { success: false, error: `Ya existe un rol con el nombre o código "${nombre}"` }
      }
      return { success: false, error: error?.message || 'Error al crear rol' }
    }

    const validPermisos = Array.from(
      new Set((input.permisos || []).filter((p) => VALID_PERMISOS_SET.has(p)))
    )

    if (validPermisos.length > 0) {
      const { error: rpErr } = await admin.from('rol_permisos').insert(
        validPermisos.map((permiso_codigo) => ({
          rol_id: created.id,
          permiso_codigo,
        }))
      )
      if (rpErr) return { success: false, error: rpErr.message }
    }

    await registrarAuditLog({
      usuario_id: ctx.userId,
      rol: ctx.rol,
      accion: 'rol.crear',
      entidad: 'roles',
      entidad_id: created.id,
      metadata: { nombre, codigo, rol_base: rolBase, total_permisos: validPermisos.length },
    })

    revalidatePath('/usuarios')
    revalidatePath('/', 'layout')
    return { success: true, id: created.id }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Error creando rol' }
  }
}

// ─── ACTUALIZAR ROL Y SU MATRIZ DE PERMISOS ──────────────────────────────────
export async function actualizarRolAction(input: {
  id: string
  nombre: string
  descripcion?: string
  color: RolColor
  rol_base: UserRol
  home_path: string
  permisos: PermisoCodigo[]
}) {
  try {
    const ctx = await getUserAuthContext()
    if (!ctx || !ctx.can('roles.gestionar')) {
      return { success: false, error: 'No tiene permiso para editar roles y permisos' }
    }

    const admin = await createAdminClient()
    const { data: existing } = await admin
      .from('roles')
      .select('*')
      .eq('id', input.id)
      .single()

    if (!existing) return { success: false, error: 'Rol no encontrado' }

    if (existing.codigo === 'admin') {
      return {
        success: false,
        error: 'El rol Administrador siempre conserva acceso total por seguridad del sistema',
      }
    }

    const nombre = input.nombre?.trim()
    if (!nombre || nombre.length < 2) {
      return { success: false, error: 'El nombre del rol es obligatorio' }
    }

    const nextRolBase: UserRol = existing.es_sistema
      ? (existing.rol_base as UserRol)
      : VALID_BASE_ROLES.includes(input.rol_base)
      ? input.rol_base
      : (existing.rol_base as UserRol)

    const { error: updErr } = await admin
      .from('roles')
      .update({
        nombre,
        descripcion: input.descripcion?.trim() || null,
        color: input.color || existing.color,
        rol_base: nextRolBase,
        home_path: input.home_path || existing.home_path,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)

    if (updErr) {
      if (updErr.code === '23505') return { success: false, error: 'Ya existe otro rol con ese nombre' }
      return { success: false, error: updErr.message }
    }

    // Si cambió el rol_base de un rol personalizado, sincronizar usuarios.rol para coherencia con RLS
    if (!existing.es_sistema && nextRolBase !== existing.rol_base) {
      await admin
        .from('usuarios')
        .update({ rol: nextRolBase, updated_at: new Date().toISOString() })
        .eq('rol_id', input.id)
    }

    // Reemplazar matriz de permisos del rol
    await admin.from('rol_permisos').delete().eq('rol_id', input.id)
    const validPermisos = Array.from(
      new Set((input.permisos || []).filter((p) => VALID_PERMISOS_SET.has(p)))
    )
    if (validPermisos.length > 0) {
      const { error: rpErr } = await admin.from('rol_permisos').insert(
        validPermisos.map((permiso_codigo) => ({
          rol_id: input.id,
          permiso_codigo,
        }))
      )
      if (rpErr) return { success: false, error: rpErr.message }
    }

    await registrarAuditLog({
      usuario_id: ctx.userId,
      rol: ctx.rol,
      accion: 'rol.actualizar',
      entidad: 'roles',
      entidad_id: input.id,
      metadata: { nombre, total_permisos: validPermisos.length },
    })

    revalidatePath('/usuarios')
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Error al actualizar rol' }
  }
}

// ─── ELIMINAR ROL PERSONALIZADO ──────────────────────────────────────────────
export async function eliminarRolAction(rolId: string) {
  try {
    const ctx = await getUserAuthContext()
    if (!ctx || !ctx.can('roles.gestionar')) {
      return { success: false, error: 'No tiene permiso para eliminar roles' }
    }

    const admin = await createAdminClient()
    const { data: role } = await admin.from('roles').select('*').eq('id', rolId).single()
    if (!role) return { success: false, error: 'Rol no encontrado' }
    if (role.es_sistema) {
      return { success: false, error: 'Los roles base del sistema no se pueden eliminar (pero sí puedes editar sus permisos)' }
    }

    const { count } = await admin
      .from('usuarios')
      .select('id', { count: 'exact', head: true })
      .eq('rol_id', rolId)

    if ((count || 0) > 0) {
      return {
        success: false,
        error: `No se puede eliminar este rol porque tiene ${count} usuario(s) asignado(s). Reasígnalos a otro rol primero.`,
      }
    }

    const { error } = await admin.from('roles').delete().eq('id', rolId)
    if (error) return { success: false, error: error.message }

    await registrarAuditLog({
      usuario_id: ctx.userId,
      rol: ctx.rol,
      accion: 'rol.eliminar',
      entidad: 'roles',
      entidad_id: rolId,
      metadata: { nombre: role.nombre, codigo: role.codigo },
    })

    revalidatePath('/usuarios')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Error al eliminar rol' }
  }
}
