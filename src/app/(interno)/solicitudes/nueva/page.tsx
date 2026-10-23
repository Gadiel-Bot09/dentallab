// src/app/(interno)/solicitudes/nueva/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import type { Area, Farmacia } from '@/types/database'
import NuevaSolicitudClient from './_components/NuevaSolicitudClient'

export const metadata: Metadata = {
  title: 'Nueva Solicitud de Insumos — DentalLab Manager',
}

interface PageProps {
  searchParams: Promise<{ duplicar?: string }>
}

export default async function NuevaSolicitudPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('id, rol')
    .eq('id', user.id)
    .single()

  const adminSupabase = await createAdminClient()
  const sp = await searchParams

  // Determinar áreas permitidas
  let areasQuery = adminSupabase.from('areas').select('*').eq('activa', true).order('nombre')

  if (profile?.rol !== 'admin') {
    // Verificar a qué áreas está asignado el usuario
    const { data: userAreas } = await adminSupabase
      .from('usuario_areas')
      .select('area_id')
      .eq('usuario_id', user.id)

    const areaIds = (userAreas || []).map((ua) => ua.area_id)
    if (areaIds.length > 0) {
      areasQuery = areasQuery.in('id', areaIds)
    }
  }

  const [{ data: areasData }, { data: farmaciasData }, { data: materialsData }, { data: allStockData }] =
    await Promise.all([
      areasQuery,
      adminSupabase.from('farmacias').select('*').eq('activa', true).order('nombre'),
      adminSupabase
        .from('inventario')
        .select(`
          id, codigo, nombre, precio_unitario, activo,
          categoria:categoria_id(nombre),
          unidad_medida:unidad_medida_id(nombre, abreviatura)
        `)
        .eq('activo', true)
        .order('nombre'),
      adminSupabase.from('stock_farmacia').select('farmacia_id, material_id, cantidad'),
    ])

  const areas = (areasData as Area[]) || []
  const farmacias = (farmaciasData as Farmacia[]) || []

  if (areas.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
        <p className="text-4xl mb-3">🏢</p>
        <h2 className="text-xl font-bold text-white">No tienes áreas asignadas</h2>
        <p className="text-slate-400 text-sm mt-1">
          {profile?.rol === 'admin'
            ? 'Aún no se han creado áreas en el sistema. Configura las áreas primero.'
            : 'Tu usuario aún no está asignado a ninguna área institucional. Solicita al administrador tu asignación.'}
        </p>
        {profile?.rol === 'admin' && (
          <a
            href="/areas"
            className="inline-block mt-4 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-sky-500/20"
          >
            Ir a Gestión de Áreas
          </a>
        )}
      </div>
    )
  }

  if (farmacias.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
        <p className="text-4xl mb-3">🏥</p>
        <h2 className="text-xl font-bold text-white">No hay farmacias activas</h2>
        <p className="text-slate-400 text-sm mt-1">
          Se requiere al menos una farmacia activa en el sistema para poder despachar insumos.
        </p>
      </div>
    )
  }

  // Mapa de stock: { [farmacia_id]: { [material_id]: cantidad } }
  const stockMap: Record<string, Record<string, number>> = {}
  ;(allStockData || []).forEach((s) => {
    if (!stockMap[s.farmacia_id]) stockMap[s.farmacia_id] = {}
    stockMap[s.farmacia_id][s.material_id] = Number(s.cantidad || 0)
  })

  // Soporte para duplicar solicitud previa
  let initialData: any = undefined
  if (sp.duplicar) {
    const { data: originalSol } = await adminSupabase
      .from('solicitudes')
      .select('*, items:solicitud_items(*)')
      .eq('id', sp.duplicar)
      .single()

    if (originalSol) {
      initialData = {
        area_id: originalSol.area_id,
        farmacia_id: originalSol.farmacia_id,
        tipo: originalSol.tipo,
        prioridad: originalSol.prioridad,
        periodo_inicio: originalSol.periodo_inicio,
        periodo_fin: originalSol.periodo_fin,
        observaciones: `Copia de ${originalSol.radicado}: ${originalSol.observaciones || ''}`.trim(),
        items: (originalSol.items || []).map((i: any) => ({
          material_id: i.material_id,
          cantidad: Number(i.cantidad_solicitada),
          observaciones: i.observaciones || '',
        })),
      }
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">
          {sp.duplicar ? 'Duplicar Solicitud de Insumos' : 'Generar Solicitud de Insumos'}
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Diligencia los materiales requeridos para tu área asistencial. La farmacia recibirá la notificación y procederá con el despacho.
        </p>
      </div>

      <NuevaSolicitudClient
        areas={areas}
        farmacias={farmacias}
        materials={(materialsData as any) || []}
        stockMap={stockMap}
        initialData={initialData}
      />
    </div>
  )
}
