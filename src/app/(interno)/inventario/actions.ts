'use server'
// src/app/(interno)/inventario/actions.ts
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { registrarAuditLog } from '@/lib/audit/logger'

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
  
  // Autogenerar código desde la base de datos
  const { data: generatedCode, error: rpcError } = await supabase.rpc('generate_material_code')
  if (rpcError || !generatedCode) throw new Error('Error generando código único para el material')
  const codigo = generatedCode

  const payload = {
    codigo,
    nombre: formData.get('nombre') as string,
    descripcion: (formData.get('descripcion') as string) || null,
    categoria_id: formData.get('categoria_id') as string,
    unidad_medida_id: formData.get('unidad_medida_id') as string,
    stock_actual: stockInicial, // If they specified a starting balance
    stock_minimo: parseFloat((formData.get('stock_minimo') as string) || '0'),
    precio_unitario: parseFloat((formData.get('precio_unitario') as string) || '0'),
    precio_venta_referencia: parseFloat((formData.get('precio_venta_referencia') as string) || '0')
  }

  // Insert base material
  const { data: newMaterial, error } = await supabase
    .from('inventario')
    .insert(payload)
    .select('id')
    .single()

  if (error || !newMaterial) {
    if (error?.code === '23505') throw new Error('Ya existe un material con ese código único')
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
