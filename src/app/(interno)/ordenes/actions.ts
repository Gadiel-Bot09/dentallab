'use server'
// src/app/(interno)/ordenes/actions.ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { registrarAuditLog } from '@/lib/audit/logger'
import { emailOrdenEnviadaLab, emailLaboratorioConfirmoRecepcion, emailOrdenListaEnLab } from '@/lib/resend/client'
import type { OrdenEstado, ModoGestion } from '@/types/database'

// ─── Reusable: Get current user profile ──────────────────────────────────────
async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('usuarios')
    .select('id, nombre, apellido, rol, email')
    .eq('id', user.id)
    .single()

  if (!profile) throw new Error('Perfil no encontrado')
  return { user, profile, supabase }
}

async function getClientIp(): Promise<string | null> {
  const headersList = await headers()
  return headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? null
}

// ─── CREATE ORDEN ─────────────────────────────────────────────────────────────
export async function crearOrdenAction(formData: FormData) {
  const { user, profile, supabase } = await getCurrentUser()
  const ip = await getClientIp()
  const adminSupabase = await createAdminClient()

  const payload = {
    paciente_id: formData.get('paciente_id') as string,
    odontologo_id: formData.get('odontologo_id') as string,
    laboratorio_id: formData.get('laboratorio_id') as string,
    tipo_trabajo: formData.get('tipo_trabajo') as string,
    descripcion: formData.get('descripcion') as string | null,
    observaciones_tecnicas: formData.get('observaciones_tecnicas') as string | null,
    precio_venta: parseFloat(formData.get('precio_venta') as string) || 0,
    fecha_estimada_entrega: (formData.get('fecha_estimada_entrega') as string) || null,
    modo_gestion: (formData.get('modo_gestion') as ModoGestion) ?? 'gestion_interna',
  }

  // Parse materials
  const materialesJson = formData.get('materiales') as string
  const materiales: Array<{ material_id: string; cantidad: number }> = materialesJson
    ? JSON.parse(materialesJson)
    : []

  // Validate stock BEFORE creating the order
  for (const mat of materiales) {
    const { data: inv } = await supabase
      .from('inventario')
      .select('stock_actual, nombre')
      .eq('id', mat.material_id)
      .single()

    if (!inv || inv.stock_actual < mat.cantidad) {
      throw new Error(`Stock insuficiente para: ${inv?.nombre ?? mat.material_id}`)
    }
  }

  // Generate radicado atomically using the Postgres function
  const { data: radicadoResult, error: radError } = await adminSupabase.rpc('generate_radicado')
  if (radError || !radicadoResult) throw new Error('No se pudo generar el radicado')

  const radicado = radicadoResult as string

  // Calculate material costs (snapshot prices)
  let costoTotalMateriales = 0
  const materialesConCosto: Array<{ material_id: string; cantidad_usada: number; costo_unitario_momento: number; stock_anterior: number }> = []

  for (const mat of materiales) {
    const { data: inv } = await supabase
      .from('inventario')
      .select('precio_unitario, stock_actual')
      .eq('id', mat.material_id)
      .single()
    if (inv) {
      const costo = inv.precio_unitario * mat.cantidad
      costoTotalMateriales += costo
      materialesConCosto.push({
        material_id: mat.material_id,
        cantidad_usada: mat.cantidad,
        costo_unitario_momento: inv.precio_unitario,
        stock_anterior: inv.stock_actual,
      })
    }
  }

  const margenGanancia =
    payload.precio_venta > 0
      ? ((payload.precio_venta - costoTotalMateriales) / payload.precio_venta) * 100
      : 0

  // Create the order
  const { data: newOrden, error: ordenError } = await supabase
    .from('ordenes_servicio')
    .insert({
      ...payload,
      radicado,
      estado: 'borrador',
      fecha_creacion: new Date().toISOString(),
      costo_total_materiales: costoTotalMateriales,
      margen_ganancia: margenGanancia,
      registrado_por_id: user.id,
    })
    .select('id')
    .single()

  if (ordenError || !newOrden) throw new Error(ordenError?.message ?? 'Error al crear orden')
  const ordenId = newOrden.id

  // Insert order materials + update inventory
  for (const mat of materialesConCosto) {
    await supabase.from('orden_materiales').insert({
      orden_id: ordenId,
      material_id: mat.material_id,
      cantidad_usada: mat.cantidad_usada,
      costo_unitario_momento: mat.costo_unitario_momento,
    })

    const nuevoStock = mat.stock_anterior - mat.cantidad_usada
    await supabase.from('inventario').update({ stock_actual: nuevoStock, updated_at: new Date().toISOString() }).eq('id', mat.material_id)
    await supabase.from('movimientos_inventario').insert({
      material_id: mat.material_id,
      orden_id: ordenId,
      tipo: 'salida',
      cantidad: -mat.cantidad_usada,
      stock_anterior: mat.stock_anterior,
      stock_resultante: nuevoStock,
      motivo: `Orden ${radicado}`,
      usuario_id: user.id,
    })
  }

  // Log creation event
  await supabase.from('eventos_orden').insert({
    orden_id: ordenId,
    tipo_evento: 'orden.creada',
    estado_anterior: null,
    estado_nuevo: 'borrador',
    descripcion: `Orden creada por ${profile.nombre} ${profile.apellido}`,
    actor_id: user.id,
    actor_rol: profile.rol,
    modo: payload.modo_gestion,
  })

  await registrarAuditLog({
    usuario_id: user.id,
    rol: profile.rol,
    accion: 'orden.crear',
    entidad: 'ordenes_servicio',
    entidad_id: ordenId,
    ip_address: ip,
    metadata: { radicado, tipo_trabajo: payload.tipo_trabajo },
  })

  redirect(`/ordenes/${ordenId}`)
}

// ─── CAMBIAR ESTADO ───────────────────────────────────────────────────────────
export async function cambiarEstadoOrdenAction(
  ordenId: string,
  nuevoEstado: OrdenEstado,
  observaciones: string,
  modo: ModoGestion,
  fechaEstimada?: string
) {
  const { user, profile, supabase } = await getCurrentUser()
  const ip = await getClientIp()

  const { data: orden, error: fetchError } = await supabase
    .from('ordenes_servicio')
    .select('id, radicado, estado, tipo_trabajo, laboratorio_id, odontologo_id, laboratorios(nombre, email), usuarios!odontologo_id(email)')
    .eq('id', ordenId)
    .single()

  if (fetchError || !orden) throw new Error('Orden no encontrada')

  const estadoAnterior = orden.estado as OrdenEstado

  // Build date updates
  const dateUpdates: Record<string, string | null> = {}
  const ahora = new Date().toISOString()
  if (nuevoEstado === 'enviada') dateUpdates.fecha_envio_lab = ahora
  if (nuevoEstado === 'recibida_lab') dateUpdates.fecha_recibido_lab = ahora
  if (nuevoEstado === 'enviada_centro') dateUpdates.fecha_enviada_centro = ahora
  if (nuevoEstado === 'recibida_centro') dateUpdates.fecha_recibida_centro = ahora
  if (fechaEstimada) dateUpdates.fecha_estimada_entrega = fechaEstimada

  await supabase.from('ordenes_servicio').update({
    estado: nuevoEstado,
    ...dateUpdates,
    updated_at: ahora,
  }).eq('id', ordenId)

  await supabase.from('eventos_orden').insert({
    orden_id: ordenId,
    tipo_evento: 'estado_cambiado',
    estado_anterior: estadoAnterior,
    estado_nuevo: nuevoEstado,
    descripcion: observaciones || `Estado cambiado de ${estadoAnterior} a ${nuevoEstado}`,
    actor_id: user.id,
    actor_rol: profile.rol,
    modo,
    metadata: { observaciones },
  })

  await registrarAuditLog({
    usuario_id: user.id,
    rol: profile.rol,
    accion: 'orden.estado.cambiado',
    entidad: 'ordenes_servicio',
    entidad_id: ordenId,
    ip_address: ip,
    metadata: { radicado: orden.radicado, estado_anterior: estadoAnterior, estado_nuevo: nuevoEstado, modo },
  })

  // ── Email notifications ─────────────────────────────────────────────────────
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const labEmail = (orden.laboratorios as any)?.email
    const odEmail = (orden.usuarios as any)?.email

    if (nuevoEstado === 'enviada' && labEmail) {
      await emailOrdenEnviadaLab({
        to: labEmail,
        radicado: orden.radicado,
        tipoTrabajo: orden.tipo_trabajo,
        pacienteNombre: '(ver sistema)',
        odontologoNombre: `${profile.nombre} ${profile.apellido}`,
        linkOrden: `${appUrl}/externo/ordenes/${ordenId}`,
      })
    }
    if (nuevoEstado === 'recibida_lab' && odEmail) {
      await emailLaboratorioConfirmoRecepcion({
        to: odEmail,
        radicado: orden.radicado,
        tipoTrabajo: orden.tipo_trabajo,
        labNombre: (orden.laboratorios as any)?.nombre ?? '',
        fechaEstimada: fechaEstimada,
      })
    }
    if (nuevoEstado === 'lista') {
      // Alert internal auxiliar/admin
      await emailOrdenListaEnLab({
        to: process.env.RESEND_FROM_EMAIL!,
        radicado: orden.radicado,
        tipoTrabajo: orden.tipo_trabajo,
        labNombre: (orden.laboratorios as any)?.nombre ?? '',
        linkOrden: `${appUrl}/ordenes/${ordenId}`,
      })
    }
  } catch (emailErr) {
    console.error('[EMAIL]', emailErr)
  }

  redirect(`/ordenes/${ordenId}`)
}
