// src/app/(interno)/usuarios/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const metadata: Metadata = {
  title: 'Usuarios — DentalLab Manager',
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (profile?.rol !== 'admin') redirect('/dashboard')

  const params = await searchParams
  const q = params.q ?? ''

  let query = supabase
    .from('usuarios')
    .select('*, laboratorios(nombre)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (q) {
    query = query.or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,email.ilike.%${q}%`)
  }

  const { data: usuarios } = await query

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestión de Usuarios</h1>
          <p className="text-slate-400 text-sm">{usuarios?.length ?? 0} usuario(s) encontrado(s)</p>
        </div>
        <Link
          href="/usuarios/nuevo"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-sky-500/20 transition-all duration-200"
        >
          + Nuevo Usuario
        </Link>
      </div>

      <form method="GET">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, apellido o email..."
          className="w-full max-w-md px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
        />
      </form>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {!usuarios || usuarios.length === 0 ? (
          <div className="px-6 py-16 text-center text-slate-500">
            <p className="text-4xl mb-3">👥</p>
            <p className="font-medium">No se encontraron usuarios</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  {['Usuario', 'Email', 'Rol', 'Clínica/Laboratorio', 'Estado', 'Registro'].map((h) => (
                    <th key={h} className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {usuarios.map((u: any) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-white font-medium">{u.nombre} {u.apellido}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-400">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center px-2.5 py-1 bg-sky-500/10 text-sky-400 rounded-lg text-xs font-medium border border-sky-500/20 capitalize">
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400">
                      {u.laboratorios?.nombre || '—'}
                    </td>
                    <td className="px-5 py-3">
                      {u.activo ? (
                        <span className="text-green-400 font-medium text-xs">Activo</span>
                      ) : (
                        <span className="text-slate-500 font-medium text-xs">Inactivo</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs">
                      {format(new Date(u.created_at), 'dd/MM/yyyy', { locale: es })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
