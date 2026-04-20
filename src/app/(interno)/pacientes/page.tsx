// src/app/(interno)/pacientes/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const metadata: Metadata = {
  title: 'Pacientes — DentalLab Manager',
}

export default async function PacientesPage({
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
    .from('pacientes')
    .select('id, numero_historia, nombre, apellido, cedula, telefono, email, created_at, usuarios!odontologo_id(nombre, apellido)')
    .order('apellido')
    .limit(200)

  if (q) {
    query = query.or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,cedula.ilike.%${q}%,numero_historia.ilike.%${q}%`)
  }

  const { data: pacientes } = await query

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Pacientes</h1>
          <p className="text-slate-400 text-sm">{pacientes?.length ?? 0} paciente(s) encontrado(s)</p>
        </div>
        <Link
          id="btn-nuevo-paciente"
          href="/pacientes/nuevo"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-sky-500/20 transition-all duration-200"
        >
          + Nuevo Paciente
        </Link>
      </div>

      {/* Search */}
      <form method="GET">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, apellido, cédula o número de historia..."
          className="w-full max-w-md px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
        />
      </form>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {!pacientes || pacientes.length === 0 ? (
          <div className="px-6 py-16 text-center text-slate-500">
            <p className="text-4xl mb-3">🧑‍⚕️</p>
            <p className="font-medium">No se encontraron pacientes</p>
            <Link href="/pacientes/nuevo" className="inline-block mt-4 text-sky-400 hover:text-sky-300 text-sm">
              + Registrar primer paciente →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  {['Historia', 'Paciente', 'Cédula', 'Teléfono', 'Odontólogo', 'Registro', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {pacientes.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs text-sky-400 font-bold">{p.numero_historia}</span>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-white font-medium">{p.apellido}, {p.nombre}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-400 font-mono text-xs">{p.cedula}</td>
                    <td className="px-5 py-3 text-slate-400">{p.telefono ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-400">
                      {p.usuarios ? `${p.usuarios.nombre} ${p.usuarios.apellido}` : '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs">
                      {format(new Date(p.created_at), 'dd/MM/yyyy', { locale: es })}
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/pacientes/${p.id}`} className="text-slate-500 hover:text-sky-400 transition-colors">→</Link>
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
