// src/app/(interno)/farmacia/stock/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import type { Farmacia } from '@/types/database'
import type { Proveedor, RecepcionFarmacia } from '@/types/farmacia'
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

  // Cargar catálogo de materiales (con campos normativos si ya fueron migrados), stock, lotes, proveedores y actas
  const [
    { data: materialsData },
    { data: stockData },
    lotesRes,
    proveedoresRes,
    recepcionesRes,
  ] = await Promise.all([
    adminSupabase
      .from('inventario')
      .select(`
        *,
        categoria:categoria_id(nombre),
        unidad_medida:unidad_medida_id(nombre, abreviatura)
      `)
      .eq('activo', true)
      .order('nombre'),
    adminSupabase
      .from('stock_farmacia')
      .select('*')
      .eq('farmacia_id', selectedFarmaciaId),
    adminSupabase
      .from('lotes_farmacia')
      .select('id, material_id, numero_lote, fecha_vencimiento, cantidad_disponible, estado')
      .eq('farmacia_id', selectedFarmaciaId)
      .in('estado', ['disponible', 'cuarentena'])
      .gt('cantidad_disponible', 0)
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false }),
    adminSupabase
      .from('proveedores')
      .select('*')
      .eq('activo', true)
      .order('razon_social'),
    adminSupabase
      .from('recepciones_farmacia')
      .select(`
        *,
        farmacia:farmacia_id(codigo, nombre),
        usuario_recibe:recibido_por(nombre, apellido)
      `)
      .eq('farmacia_id', selectedFarmaciaId)
      .order('fecha_recepcion', { ascending: false })
      .limit(100),
  ])

  const stockMap = new Map((stockData || []).map((s) => [s.material_id, s]))

  // Agrupar resumen de lotes por material (próximo vencimiento FEFO, conteo de lotes y cuarentena)
  const lotesPorMaterial = new Map<
    string,
    {
      lotes_activos: number
      lotes_cuarentena: number
      proximo_vencimiento: string | null
      proximo_lote: string | null
    }
  >()

  for (const l of lotesRes.data || []) {
    const curr = lotesPorMaterial.get(l.material_id) || {
      lotes_activos: 0,
      lotes_cuarentena: 0,
      proximo_vencimiento: null,
      proximo_lote: null,
    }
    if (l.estado === 'disponible') {
      curr.lotes_activos += 1
      if (!curr.proximo_vencimiento && l.fecha_vencimiento) {
        curr.proximo_vencimiento = l.fecha_vencimiento
        curr.proximo_lote = l.numero_lote
      } else if (!curr.proximo_lote) {
        curr.proximo_lote = l.numero_lote
      }
    } else if (l.estado === 'cuarentena') {
      curr.lotes_cuarentena += 1
    }
    lotesPorMaterial.set(l.material_id, curr)
  }

  // Construir filas completas combinando inventario con stock_farmacia y resumen de lotes
  const stockList = (materialsData || []).map((m: any) => {
    const s = stockMap.get(m.id)
    const lotInfo = lotesPorMaterial.get(m.id)
    return {
      material_id: m.id,
      codigo: m.codigo,
      nombre: m.nombre,
      codigo_barras: m.codigo_barras || null,
      registro_sanitario: m.registro_sanitario || null,
      categoria: m.categoria?.nombre || 'General',
      unidad: m.unidad_medida?.abreviatura || m.unidad_medida?.nombre || 'Und',
      cantidad: s ? Number(s.cantidad) : 0,
      stock_minimo: s ? Number(s.stock_minimo) : 0,
      stock_maximo: s && s.stock_maximo != null ? Number(s.stock_maximo) : null,
      costo_promedio: s ? Number(s.costo_promedio) : Number(m.precio_unitario || 0),
      lotes_activos: lotInfo?.lotes_activos ?? 0,
      lotes_cuarentena: lotInfo?.lotes_cuarentena ?? 0,
      proximo_vencimiento: lotInfo?.proximo_vencimiento ?? null,
      proximo_lote: lotInfo?.proximo_lote ?? null,
    }
  })

  const userCanManage = profile?.rol === 'admin' || profile?.rol === 'farmacia'

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Stock y Existencias de Farmacia</h1>
        <p className="text-slate-400 text-sm mt-1">
          Control normativo de existencias, recepción técnica (lotes, vencimientos, INVIMA, código de barras), alertas FEFO y actas de ingreso.
        </p>
      </div>

      <StockFarmaciaClient
        farmacias={farmacias}
        initialFarmaciaId={selectedFarmaciaId}
        stockList={stockList}
        allMaterials={(materialsData as any) || []}
        proveedores={((proveedoresRes.data as any) || []) as Proveedor[]}
        recepciones={((recepcionesRes.data as any) || []) as RecepcionFarmacia[]}
        userCanManage={userCanManage}
      />
    </div>
  )
}
