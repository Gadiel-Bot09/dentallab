// src/app/(interno)/usuarios/nuevo/page.tsx
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getUserAuthContext } from '@/lib/rbac-server'
import UsuarioForm from '../_components/UsuarioForm'

export const metadata: Metadata = {
  title: 'Nuevo Usuario — DentalLab Manager',
}

export default async function NuevoUsuarioPage() {
  const ctx = await getUserAuthContext()
  if (!ctx) redirect('/login')
  if (!ctx.can('usuarios.gestionar')) redirect('/dashboard?error=sin_permiso')

  const admin = await createAdminClient()

  const [{ data: laboratorios }, { data: roles }, { data: areas }, { data: farmacias }] =
    await Promise.all([
      admin.from('laboratorios').select('id, nombre').order('nombre'),
      admin.from('roles').select('id, codigo, nombre, rol_base, es_sistema').eq('activo', true).order('es_sistema', { ascending: false }).order('nombre'),
      admin.from('areas').select('id, codigo, nombre').eq('activa', true).order('nombre'),
      admin.from('farmacias').select('id, codigo, nombre').eq('activa', true).order('nombre'),
    ])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <a href="/usuarios" className="text-slate-500 hover:text-sky-400 text-sm transition-colors">
          ← Volver a Usuarios y Roles
        </a>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-white">Registrar Nuevo Usuario</h1>
        <p className="text-slate-400 text-sm mt-1">
          Cree una cuenta asignando un rol del sistema o personalizado, áreas institucionales y farmacias.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8">
        <UsuarioForm
          laboratorios={laboratorios || []}
          roles={roles || []}
          areas={areas || []}
          farmacias={farmacias || []}
        />
      </div>
    </div>
  )
}
