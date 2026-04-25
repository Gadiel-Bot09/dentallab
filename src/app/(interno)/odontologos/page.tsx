// src/app/(interno)/odontologos/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Directorio de Odontólogos — DentalLab Manager',
}

export default async function OdontologosPage({
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
    .from('usuarios')
    .select('*, laboratorios(nombre), especialidades(nombre)')
    .eq('rol', 'odontologo')
    .order('apellido')

  if (q) {
    query = query.or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,documento.ilike.%${q}%`)
  }

  const { data: odontologos } = await query

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Directorio Médico (Odontólogos)</h1>
          <p className="text-slate-400 text-sm">{odontologos?.length ?? 0} profesionales registrados.</p>
        </div>
        {/* Aquí podríamos agregar un botón que abra el modal si quisiéramos crear desde esta pantalla */}
      </div>

      <form method="GET">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, apellido o documento..."
          className="w-full max-w-md px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
        />
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {!odontologos || odontologos.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-slate-900 border border-slate-800 rounded-2xl">
            <p className="text-4xl mb-3">👨‍⚕️</p>
            <p className="text-slate-400 font-medium">No se encontraron odontólogos</p>
          </div>
        ) : (
          odontologos.map((doc: any) => (
            <div key={doc.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-500/20 to-indigo-500/20 flex items-center justify-center border border-sky-500/20">
                  <span className="text-xl">🦷</span>
                </div>
                {doc.activo ? (
                  <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                )}
              </div>
              
              <h3 className="text-lg font-bold text-white leading-tight mb-1">
                Dr(a). {doc.nombre} {doc.apellido}
              </h3>
              
              <p className="text-sky-400 text-sm font-medium mb-4">
                {doc.especialidades?.nombre || 'Odontología General'}
              </p>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <span>🏢</span>
                  <span className="truncate">{doc.laboratorios?.nombre || 'Clínica Independiente'}</span>
                </div>
                {doc.documento && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <span>🪪</span>
                    <span>{doc.documento}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-400">
                  <span>✉️</span>
                  <span className="truncate">{doc.email}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
