// src/app/(interno)/laboratorios/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const metadata: Metadata = {
  title: 'Laboratorios — DentalLab Manager',
}

export default async function LaboratoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const q = params.q ?? ''

  let query = supabase
    .from('laboratorios')
    .select('*')
    .order('nombre')
    .limit(200)

  if (q) {
    query = query.or(`nombre.ilike.%${q}%,contacto.ilike.%${q}%,email.ilike.%${q}%,telefono.ilike.%${q}%`)
  }

  const { data: laboratorios } = await query

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Laboratorios</h1>
          <p className="text-slate-400 text-sm">{laboratorios?.length ?? 0} laboratorio(s) encontrado(s)</p>
        </div>
        <Link
          id="btn-nuevo-laboratorio"
          href="/laboratorios/nuevo"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-sky-500/20 transition-all duration-200"
        >
          + Nuevo Laboratorio
        </Link>
      </div>

      {/* Search */}
      <form method="GET">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, contacto, email o teléfono..."
          className="w-full max-w-md px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
        />
      </form>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {!laboratorios || laboratorios.length === 0 ? (
          <div className="px-6 py-16 text-center text-slate-500">
            <p className="text-4xl mb-3">🔬</p>
            <p className="font-medium">No se encontraron laboratorios</p>
            <Link href="/laboratorios/nuevo" className="inline-block mt-4 text-sky-400 hover:text-sky-300 text-sm">
              + Registrar primer laboratorio →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  {['Nombre', 'Contacto', 'Email / Teléfono', 'Portal', 'Registro', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {laboratorios.map((l: any) => (
                  <tr key={l.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3 text-white font-medium">
                      {l.nombre}
                    </td>
                    <td className="px-5 py-3 text-slate-400">
                      {l.contacto || '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-slate-300 text-xs">{l.email || '—'}</div>
                      <div className="text-slate-500 text-xs">{l.telefono || '—'}</div>
                    </td>
                    <td className="px-5 py-3">
                      {l.portal_activo ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs font-medium border border-green-500/20">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-800 text-slate-400 rounded text-xs font-medium border border-slate-700">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs">
                      {format(new Date(l.created_at), 'dd/MM/yyyy', { locale: es })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/laboratorios/${l.id}`} className="text-slate-500 hover:text-sky-400 transition-colors">Editar →</Link>
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
