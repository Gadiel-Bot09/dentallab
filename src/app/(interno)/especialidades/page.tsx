// src/app/(interno)/especialidades/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import EspecialidadForm from './_components/EspecialidadForm'

export const metadata: Metadata = {
  title: 'Especialidades Odontológicas — DentalLab Manager',
}

export default async function EspecialidadesPage({
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
    .from('especialidades')
    .select('*')
    .order('nombre')

  if (q) {
    query = query.ilike('nombre', `%${q}%`)
  }

  const { data: especialidades } = await query

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Especialidades</h1>
          <p className="text-slate-400 text-sm">Administra las especialidades odontológicas disponibles en el sistema.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario (Creación Rápida) */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sticky top-6">
            <h2 className="text-lg font-bold text-white mb-4">Nueva Especialidad</h2>
            <EspecialidadForm />
          </div>
        </div>

        {/* Listado */}
        <div className="lg:col-span-2 space-y-4">
          <form method="GET">
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar especialidad..."
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          </form>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {!especialidades || especialidades.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-500">
                <p className="text-3xl mb-3">🦷</p>
                <p className="font-medium">No hay especialidades registradas</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-left">
                      <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Especialidad</th>
                      <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Estado</th>
                      <th className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Registro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {especialidades.map((e: any) => (
                      <tr key={e.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-4">
                          <p className="text-white font-medium">{e.nombre}</p>
                          {e.descripcion && <p className="text-slate-500 text-xs mt-0.5">{e.descripcion}</p>}
                        </td>
                        <td className="px-5 py-4">
                          {e.activa ? (
                            <span className="text-green-400 font-medium text-xs">Activa</span>
                          ) : (
                            <span className="text-slate-500 font-medium text-xs">Inactiva</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-500 text-xs">
                          {format(new Date(e.created_at), 'dd/MM/yyyy')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
