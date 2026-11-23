// src/app/(interno)/usuarios/page.tsx
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getUserAuthContext } from '@/lib/rbac-server'
import {
  DEFAULT_ROLE_PERMISSIONS,
  type PermisoCodigo,
  type RolColor,
  type RolConPermisos,
  type UsuarioPermisoOverride,
} from '@/lib/rbac'
import { ROL_LABELS, type UserRol } from '@/types/database'
import UsuariosGestionClient from './_components/UsuariosGestionClient'
import type { UsuarioRowData } from './_components/ModalUsuarioEditor'

export const metadata: Metadata = {
  title: 'Usuarios, Roles y Permisos — DentalLab Manager',
}

function buildFallbackRoles(): RolConPermisos[] {
  const baseDefs: { codigo: UserRol; color: RolColor; home: string; desc: string }[] = [
    { codigo: 'admin', color: 'sky', home: '/dashboard', desc: 'Acceso total al sistema' },
    { codigo: 'farmacia', color: 'emerald', home: '/solicitudes', desc: 'Gestión de farmacia, stock y despachos' },
    { codigo: 'jefe_area', color: 'amber', home: '/solicitudes', desc: 'Solicitudes de insumos y devoluciones por área' },
    { codigo: 'odontologo', color: 'indigo', home: '/dashboard', desc: 'Órdenes protésicas con odontograma y pacientes' },
    { codigo: 'auxiliar', color: 'violet', home: '/dashboard', desc: 'Apoyo clínico, solicitudes y laboratorio' },
    { codigo: 'recepcionista', color: 'rose', home: '/dashboard', desc: 'Recepción, pacientes y seguimiento' },
    { codigo: 'laboratorio', color: 'slate', home: '/externo/ordenes', desc: 'Portal externo de laboratorio aliado' },
  ]
  return baseDefs.map((b) => ({
    id: b.codigo,
    codigo: b.codigo,
    nombre: ROL_LABELS[b.codigo] || b.codigo,
    descripcion: b.desc,
    color: b.color,
    es_sistema: true,
    rol_base: b.codigo,
    home_path: b.home,
    activo: true,
    permisos: DEFAULT_ROLE_PERMISSIONS[b.codigo] || [],
    usuarios_count: 0,
  }))
}

export default async function UsuariosPage() {
  const ctx = await getUserAuthContext()
  if (!ctx) redirect('/login')

  if (!ctx.canAny(['usuarios.ver', 'usuarios.gestionar', 'roles.gestionar'])) {
    redirect('/dashboard?error=sin_permiso')
  }

  const admin = await createAdminClient()

  const [
    usuariosRes,
    areasRes,
    farmaciasRes,
    laboratoriosRes,
    userAreasRes,
    userFarmaciasRes,
    rolesRes,
    rolPermisosRes,
    userPermisosRes,
  ] = await Promise.all([
    admin
      .from('usuarios')
      .select('*, laboratorios(nombre)')
      .order('created_at', { ascending: false })
      .limit(300),
    admin.from('areas').select('id, codigo, nombre').eq('activa', true).order('nombre'),
    admin.from('farmacias').select('id, codigo, nombre').eq('activa', true).order('nombre'),
    admin.from('laboratorios').select('id, nombre').order('nombre'),
    admin.from('usuario_areas').select('usuario_id, area_id'),
    admin.from('usuario_farmacias').select('usuario_id, farmacia_id'),
    admin.from('roles').select('*').order('es_sistema', { ascending: false }).order('nombre'),
    admin.from('rol_permisos').select('rol_id, permiso_codigo'),
    admin.from('usuario_permisos').select('usuario_id, permiso_codigo, concedido'),
  ])

  const rbacMigrationReady = !rolesRes.error && Array.isArray(rolesRes.data) && rolesRes.data.length > 0

  // Mapear áreas y farmacias por usuario
  const areasByUser = new Map<string, string[]>()
  for (const row of userAreasRes.data || []) {
    const arr = areasByUser.get(row.usuario_id) || []
    arr.push(row.area_id)
    areasByUser.set(row.usuario_id, arr)
  }

  const farmaciasByUser = new Map<string, string[]>()
  for (const row of userFarmaciasRes.data || []) {
    const arr = farmaciasByUser.get(row.usuario_id) || []
    arr.push(row.farmacia_id)
    farmaciasByUser.set(row.usuario_id, arr)
  }

  const overridesByUser = new Map<string, UsuarioPermisoOverride[]>()
  for (const row of userPermisosRes.data || []) {
    const arr = overridesByUser.get(row.usuario_id) || []
    arr.push({
      permiso_codigo: row.permiso_codigo as PermisoCodigo,
      concedido: Boolean(row.concedido),
    })
    overridesByUser.set(row.usuario_id, arr)
  }

  const usuarios: UsuarioRowData[] = (usuariosRes.data || []).map((u: any) => ({
    id: u.id,
    nombre: u.nombre,
    apellido: u.apellido,
    email: u.email,
    rol: u.rol,
    rol_id: u.rol_id ?? null,
    activo: Boolean(u.activo),
    laboratorio_id: u.laboratorio_id ?? null,
    laboratorio_nombre: u.laboratorios?.nombre ?? null,
    created_at: u.created_at,
    area_ids: areasByUser.get(u.id) || [],
    farmacia_ids: farmaciasByUser.get(u.id) || [],
    overrides: overridesByUser.get(u.id) || [],
  }))

  // Construir roles con permisos y conteo de usuarios
  let roles: RolConPermisos[]
  if (rbacMigrationReady) {
    const permsByRol = new Map<string, PermisoCodigo[]>()
    for (const rp of rolPermisosRes.data || []) {
      const arr = permsByRol.get(rp.rol_id) || []
      arr.push(rp.permiso_codigo as PermisoCodigo)
      permsByRol.set(rp.rol_id, arr)
    }

    roles = (rolesRes.data || []).map((r: any) => ({
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      descripcion: r.descripcion,
      color: (r.color || 'sky') as RolColor,
      es_sistema: Boolean(r.es_sistema),
      rol_base: r.rol_base as UserRol,
      home_path: r.home_path || '/dashboard',
      activo: Boolean(r.activo),
      permisos: permsByRol.get(r.id) || [],
      usuarios_count: usuarios.filter((u) => u.rol_id === r.id || (!u.rol_id && u.rol === r.codigo)).length,
    }))
  } else {
    roles = buildFallbackRoles().map((r) => ({
      ...r,
      usuarios_count: usuarios.filter((u) => u.rol === r.codigo).length,
    }))
  }

  return (
    <div className="max-w-7xl mx-auto">
      <UsuariosGestionClient
        usuarios={usuarios}
        roles={roles}
        areas={areasRes.data || []}
        farmacias={farmaciasRes.data || []}
        laboratorios={laboratoriosRes.data || []}
        currentUserId={ctx.userId}
        canManageUsers={ctx.can('usuarios.gestionar')}
        canManageRoles={ctx.can('roles.gestionar')}
        rbacMigrationReady={rbacMigrationReady}
      />
    </div>
  )
}
