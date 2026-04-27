// src/app/(interno)/categorias-inventario/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import CategoriaInventarioForm from './_components/CategoriaInventarioForm'

export const metadata: Metadata = {
  title: 'Categorías Inventario — DentalLab Manager',
}

export default async function CategoriasInventarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (profile?.rol !== 'admin') redirect('/dashboard')

  const { data: categorias } = await supabase
    .from('categorias_inventario')
    .select('*')
    .order('nombre')

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Categorías de Inventario</h1>
        <p className="text-slate-400 text-sm mt-1">
          Gestiona las categorías bajo las cuales clasificas tus materiales e insumos.
        </p>
      </div>

      <CategoriaInventarioForm categorias={categorias ?? []} />
    </div>
  )
}
