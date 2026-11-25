'use server'
// src/app/(interno)/inventario/actions.ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { registrarAuditLog } from '@/lib/audit/logger'
import { TIPOS_ITEM_INVENTARIO, type TipoItemInventario } from '@/lib/inventario-tipos'

async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data: profile } = await supabase.from('usuarios').select('id, rol, nombre, apellido').eq('id', user.id).single()
  if (!profile) throw new Error('Perfil no encontrado')
  if (profile.rol !== 'admin') throw new Error('Solo los administradores pueden crear materiales')
  return { user, profile, supabase }
}

export async function crearMaterialAction(formData: FormData) {
  const { user, profile, supabase } = await getCurrentUser()
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') ?? null

  const stockInicial = parseFloat((formData.get('stock_inicial') as string) || '0')
  const rawTipo = (formData.get('tipo_item') as string) || 'material'
  const tipoItem: TipoItemInventario =
    rawTipo === 'insumo' || rawTipo === 'medicamento' || rawTipo === 'material'
      ? rawTipo
      : 'material'

  // Autogenerar código diferenciado según tipo_item (INS-XXXX / MED-XXXX / MAT-XXXX)
  const admin = await createAdminClient()
  let codigo: string | null = null
  const { data: rpcCode, error: rpcError } = await admin.rpc('generate_inventario_code', {
    p_tipo: tipoItem,
  })
  if (!rpcError && rpcCode) {
    codigo = rpcCode as string
  } else {
    const prefijo = TIPOS_ITEM_INVENTARIO[tipoItem].prefijo
    const { data: existingCodes } = await admin
      .from('inventario')
      .select('codigo')
      .like('codigo', `${prefijo}-%`)
    let maxNum = 0
    for (const row of existingCodes || []) {
      const m = String(row.codigo || '').match(new RegExp(`^${prefijo}-(\\d+)$`))
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
    }
    codigo = `${prefijo}-${String(maxNum + 1).padStart(4, '0')}`
  }

  const payload: Record<string, any> = {
    codigo,
    tipo_item: tipoItem,
    nombre: formData.get('nombre') as string,
    descripcion: (formData.get('descripcion') as string) || null,
    categoria_id: formData.get('categoria_id') as string,
    unidad_medida_id: formData.get('unidad_medida_id') as string,
    stock_actual: stockInicial, // If they specified a starting balance
    stock_minimo: parseFloat((formData.get('stock_minimo') as string) || '0'),
    precio_unitario: parseFloat((formData.get('precio_unitario') as string) || '0'),
    precio_venta_referencia: parseFloat((formData.get('precio_venta_referencia') as string) || '0'),
    codigo_barras: ((formData.get('codigo_barras') as string) || '').trim() || null,
    registro_sanitario: ((formData.get('registro_sanitario') as string) || '').trim() || null,
    clasificacion_riesgo: ((formData.get('clasificacion_riesgo') as string) || 'insumo_general').trim(),
    laboratorio_fabricante: ((formData.get('laboratorio_fabricante') as string) || '').trim() || null,
    presentacion_comercial: ((formData.get('presentacion_comercial') as string) || '').trim() || null,
    condiciones_almacenamiento: ((formData.get('condiciones_almacenamiento') as string) || 'ambiente').trim(),
    iva_porcentaje: parseFloat((formData.get('iva_porcentaje') as string) || '0'),
    requiere_lote: formData.get('requiere_lote') === 'on',
    requiere_vencimiento: formData.get('requiere_vencimiento') === 'on',
  }

  // Insert base material (con fallback seguro si aún no se corre 00011)
  let { data: newMaterial, error } = await supabase
    .from('inventario')
    .insert(payload)
    .select('id')
    .single()

  if (error && error.message?.includes('tipo_item')) {
    const { tipo_item: _omit, ...fallbackPayload } = payload
    const retry = await supabase.from('inventario').insert(fallbackPayload).select('id').single()
    newMaterial = retry.data
    error = retry.error
  }

  if (error || !newMaterial) {
    if (error?.code === '23505') throw new Error('Ya existe un material con ese código único o código de barras')
    throw new Error(error?.message ?? 'Error creando material')
  }

  // If initial stock was provided, create an automatic adjustment entry so it's traceable
  if (stockInicial > 0) {
    await supabase.from('movimientos_inventario').insert({
      material_id: newMaterial.id,
      tipo: 'entrada',
      cantidad: stockInicial,
      stock_anterior: 0,
      stock_resultante: stockInicial,
      motivo: 'Inventario inicial del sistema',
      usuario_id: user.id
    })
  }

  await registrarAuditLog({
    usuario_id: user.id,
    rol: profile.rol,
    accion: 'inventario.crear',
    entidad: 'inventario',
    entidad_id: newMaterial.id,
    ip_address: ip,
    metadata: { codigo: payload.codigo, nombre: payload.nombre, stock_inicial: stockInicial },
  })

  redirect(`/inventario`)
}
