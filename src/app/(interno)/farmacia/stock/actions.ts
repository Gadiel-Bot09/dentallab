'use server'
// src/app/(interno)/farmacia/stock/actions.ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  CondicionAlmacenamiento,
  DictamenTecnico,
  EstadoLote,
  LoteFarmacia,
  Proveedor,
  RecepcionFarmacia,
  TipoDocumentoRecepcion,
} from '@/types/farmacia'

export interface RecepcionNormativaItemInput {
  material_id: string
  cantidad: number
  costo_unitario: number
  descuento_porcentaje?: number
  iva_porcentaje?: number
  precio_venta_sugerido?: number | null
  numero_lote?: string | null
  fecha_vencimiento?: string | null
  fecha_fabricacion?: string | null
  codigo_barras?: string | null
  registro_sanitario?: string | null
  laboratorio_fabricante?: string | null
  presentacion?: string | null
  condiciones_almacenamiento?: CondicionAlmacenamiento
  cumple_especificaciones?: boolean
  estado_recepcion?: 'disponible' | 'cuarentena' | 'rechazado'
  actualizar_catalogo?: boolean
  observaciones?: string | null
}

export interface RecepcionNormativaInput {
  farmacia_id: string
  proveedor_id?: string | null
  proveedor_nombre?: string | null
  proveedor_nit?: string | null
  tipo_documento: TipoDocumentoRecepcion
  numero_documento?: string | null
  fecha_documento?: string | null
  temperatura_recepcion?: number | null
  humedad_recepcion?: number | null
  condiciones_empaque_ok: boolean
  cadena_frio_ok: boolean
  dictamen_tecnico: DictamenTecnico
  observaciones?: string | null
  items: RecepcionNormativaItemInput[]
}

export async function crearProveedorAction(input: {
  nit: string
  razon_social: string
  nombre_comercial?: string
  telefono?: string
  email?: string
  direccion?: string
  ciudad?: string
  contacto_nombre?: string
}): Promise<{ success: boolean; data?: Proveedor; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const { data: profile } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'farmacia'].includes(profile.rol)) {
      return { success: false, error: 'No tiene permisos para registrar proveedores' }
    }

    const nit = input.nit?.trim()
    const razon_social = input.razon_social?.trim()
    if (!nit) return { success: false, error: 'El NIT / Documento del proveedor es obligatorio' }
    if (!razon_social) return { success: false, error: 'La Razón Social es obligatoria' }

    const admin = await createAdminClient()
    const { data, error } = await admin
      .from('proveedores')
      .insert({
        nit,
        razon_social,
        nombre_comercial: input.nombre_comercial?.trim() || null,
        telefono: input.telefono?.trim() || null,
        email: input.email?.trim() || null,
        direccion: input.direccion?.trim() || null,
        ciudad: input.ciudad?.trim() || null,
        contacto_nombre: input.contacto_nombre?.trim() || null,
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: `Ya existe un proveedor registrado con el NIT ${nit}` }
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/farmacia/stock')
    return { success: true, data: data as Proveedor }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al registrar proveedor' }
  }
}

export async function registrarRecepcionNormativaAction(
  payload: RecepcionNormativaInput
): Promise<{
  success: boolean
  data?: { id: string; radicado: string; items_count: number; valor_total: number }
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    if (!payload.farmacia_id) return { success: false, error: 'Debe seleccionar una farmacia' }
    if (!payload.items || payload.items.length === 0) {
      return { success: false, error: 'Debe incluir al menos un insumo' }
    }

    const { data, error } = await supabase.rpc('fn_registrar_recepcion_normativa', {
      p_farmacia_id: payload.farmacia_id,
      p_proveedor_id: payload.proveedor_id || null,
      p_proveedor_nombre: payload.proveedor_nombre || null,
      p_proveedor_nit: payload.proveedor_nit || null,
      p_tipo_documento: payload.tipo_documento || 'factura',
      p_numero_documento: payload.numero_documento || null,
      p_fecha_documento: payload.fecha_documento || null,
      p_temperatura: payload.temperatura_recepcion ?? null,
      p_humedad: payload.humedad_recepcion ?? null,
      p_condiciones_empaque_ok: payload.condiciones_empaque_ok,
      p_cadena_frio_ok: payload.cadena_frio_ok,
      p_dictamen_tecnico: payload.dictamen_tecnico || 'aprobado',
      p_observaciones: payload.observaciones || null,
      p_items: payload.items,
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/farmacia/stock')
    revalidatePath('/farmacia/kardex')
    revalidatePath('/inventario')
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al registrar recepción normativa' }
  }
}

export async function obtenerLotesMaterialAction(
  farmaciaId: string,
  materialId: string
): Promise<{ success: boolean; data?: LoteFarmacia[]; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const admin = await createAdminClient()
    const { data, error } = await admin
      .from('lotes_farmacia')
      .select('*')
      .eq('farmacia_id', farmaciaId)
      .eq('material_id', materialId)
      .order('estado', { ascending: true })
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false })

    if (error) return { success: false, error: error.message }
    return { success: true, data: (data || []) as LoteFarmacia[] }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al cargar lotes' }
  }
}

export async function cambiarEstadoLoteAction(
  loteId: string,
  nuevoEstado: Extract<EstadoLote, 'disponible' | 'cuarentena' | 'vencido' | 'retirado'>,
  motivo: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    if (!motivo || !motivo.trim()) {
      return { success: false, error: 'El motivo técnico es obligatorio' }
    }

    const { error } = await supabase.rpc('fn_cambiar_estado_lote', {
      p_lote_id: loteId,
      p_nuevo_estado: nuevoEstado,
      p_motivo: motivo.trim(),
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/farmacia/stock')
    revalidatePath('/farmacia/kardex')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al actualizar estado del lote' }
  }
}

export async function obtenerDetalleRecepcionAction(
  recepcionId: string
): Promise<{ success: boolean; data?: RecepcionFarmacia; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const admin = await createAdminClient()
    const { data, error } = await admin
      .from('recepciones_farmacia')
      .select(`
        *,
        farmacia:farmacia_id(codigo, nombre, ubicacion),
        usuario_recibe:recibido_por(nombre, apellido),
        items:recepcion_items(
          *,
          material:material_id(id, codigo, nombre, unidad_medida:unidad_medida_id(nombre, abreviatura))
        )
      `)
      .eq('id', recepcionId)
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as unknown as RecepcionFarmacia }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al consultar acta de recepción' }
  }
}

export async function registrarEntradaAction(
  farmaciaId: string,
  items: { material_id: string; cantidad: number; costo_unitario: number }[],
  proveedor?: string,
  documento?: string,
  observaciones?: string
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    if (!farmaciaId) return { success: false, error: 'Debe seleccionar una farmacia' }
    if (!items || items.length === 0) return { success: false, error: 'Debe incluir al menos un insumo' }

    const { data, error } = await supabase.rpc('fn_registrar_entrada', {
      p_farmacia_id: farmaciaId,
      p_items: items,
      p_proveedor: proveedor || null,
      p_documento: documento || null,
      p_observaciones: observaciones || null,
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/farmacia/stock')
    revalidatePath('/farmacia/kardex')
    return { success: true, count: data }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al registrar entrada' }
  }
}

export async function ajustarStockAction(
  farmaciaId: string,
  materialId: string,
  cantidadReal: number,
  motivo: string
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    if (!farmaciaId || !materialId) return { success: false, error: 'Datos incompletos' }
    if (!motivo || !motivo.trim()) return { success: false, error: 'El motivo del ajuste es obligatorio' }

    const { error } = await supabase.rpc('fn_ajustar_stock', {
      p_farmacia_id: farmaciaId,
      p_material_id: materialId,
      p_cantidad_real: cantidadReal,
      p_motivo: motivo.trim(),
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/farmacia/stock')
    revalidatePath('/farmacia/kardex')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al ajustar stock' }
  }
}

export async function trasladarStockAction(
  origenId: string,
  destinoId: string,
  items: { material_id: string; cantidad: number }[],
  observaciones?: string
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    if (!origenId || !destinoId) return { success: false, error: 'Debe indicar farmacia origen y destino' }
    if (origenId === destinoId) return { success: false, error: 'Origen y destino deben ser distintos' }

    const { data, error } = await supabase.rpc('fn_trasladar_stock', {
      p_origen: origenId,
      p_destino: destinoId,
      p_items: items,
      p_observaciones: observaciones || null,
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/farmacia/stock')
    revalidatePath('/farmacia/kardex')
    return { success: true, radicado: data }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al trasladar insumos' }
  }
}

export async function configurarStockAction(
  farmaciaId: string,
  materialId: string,
  minimo: number,
  maximo: number | null
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const { error } = await supabase.rpc('fn_configurar_stock', {
      p_farmacia_id: farmaciaId,
      p_material_id: materialId,
      p_minimo: minimo,
      p_maximo: maximo,
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/farmacia/stock')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al configurar stock' }
  }
}
