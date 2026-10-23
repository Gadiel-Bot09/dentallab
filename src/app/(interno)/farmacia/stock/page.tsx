// src/app/(interno)/farmacia/stock/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import type { Farmacia } from '@/types/database'
import StockFarmaciaClient from './_components/StockFarmaciaClient'

export const metadata: Metadata = {
  title: 'Stock de Farmacia — DentalLab Manager',
}

interface PageProps {
  searchParams: Promise<{ farmacia_id?: string }>
}

export default async function StockFarmaciaPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('id, rol')
    .eq('id', user.id)
    .single()

  const adminSupabase = await createAdminClient()

  // Cargar farmacias activas
  const { data: farmaciasData } = await adminSupabase
    .from('farmacias')
    .select('*')
    .eq('activa', true)
    .order('nombre')

  const farmacias = (farmaciasData as Farmacia[]) || []

  if (farmacias.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
        <p className="text-4xl mb-3">🏥</p>
        <h2 className="text-xl font-bold text-white">No hay farmacias registradas</h2>
        <p className="text-slate-400 text-sm mt-1">
          Primero debes registrar al menos una farmacia o bodega central en el sistema.
        </p>
        {profile?.rol === 'admin' && (
          <a
            href="/farmacias"
            className="inline-block mt-4 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-emerald-600/20"
          >
            Ir a Configurar Farmacias
          </a>
        )}
      </div>
    )
  }

  const sp = await searchParams
  const selectedFarmaciaId =
    sp.farmacia_id && farmacias.some((f) => f.id === sp.farmacia_id)
      ? sp.farmacia_id
      : farmacias[0].id

  // Cargar catálogo de materiales
  const { data: materialsData } = await adminSupabase
    .from('inventario')
    .select(`
      id, codigo, nombre, precio_unitario, activo,
      categoria:categoria_id(nombre),
      unidad_medida:unidad_medida_id(nombre, abreviatura)
    `)
    .eq('activo', true)
    .order('nombre')

  // Cargar saldo de stock en esta farmacia
  const { data: stockData } = await adminSupabase
    .from('stock_farmacia')
    .select('*')
    .eq('farmacia_id', selectedFarmaciaId)

  const stockMap = new Map((stockData || []).map((s) => [s.material_id, s]))

  // Construir filas completas combinando inventario con stock_farmacia
  const stockList = (materialsData || []).map((m: any) => {
    const s = stockMap.get(m.id)
    return {
      material_id: m.id,
      codigo: m.codigo,
      nombre: m.nombre,
      categoria: m.categoria?.nombre || 'General',
      unidad: m.unidad_medida?.abreviatura || m.unidad_medida?.nombre || 'Und',
      cantidad: s ? Number(s.cantidad) : 0,
      stock_minimo: s ? Number(s.stock_minimo) : 0,
      stock_maximo: s && s.stock_maximo != null ? Number(s.stock_maximo) : null,
      costo_promedio: s ? Number(s.costo_promedio) : Number(m.precio_unitario || 0),
    }
  })

  const userCanManage = profile?.rol === 'admin' || profile?.rol === 'farmacia'

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Stock y Existencias de Farmacia</h1>
        <p className="text-slate-400 text-sm mt-1">
          Control de existencias por farmacia, entradas de compras, ajustes físicos y alertas de stock mínimo.
        </p>
      </div>

      <StockFarmaciaClient
        farmacias={farmacias}
        initialFarmaciaId={selectedFarmaciaId}
        stockList={stockList}
        allMaterials={(materialsData as any) || []}
        userCanManage={userCanManage}
      />
    </div>
  )
}
