'use server'
// src/app/(interno)/pacientes/actions.ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { registrarAuditLog } from '@/lib/audit/logger'

async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data: profile } = await supabase.from('usuarios').select('id, rol, nombre, apellido').eq('id', user.id).single()
  if (!profile) throw new Error('Perfil no encontrado')
  return { user, profile, supabase }
}

export async function crearPacienteAction(formData: FormData) {
  const { user, profile, supabase } = await getCurrentUser()

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') ?? null

  // Generate historia number — try RPC first, fallback to timestamp-based code
  let historia: string
  try {
    const adminSupabase = await createAdminClient()
    const { data, error: histError } = await adminSupabase.rpc('generate_paciente_historia')
    if (histError || !data) throw new Error(histError?.message ?? 'RPC returned null')
    historia = data as string
  } catch (rpcErr: any) {
    // Fallback: generate a unique code using timestamp
    const now = new Date()
    const year = now.getFullYear()
    const seq = String(now.getTime()).slice(-4)
    historia = `HC-${year}-${seq}`
  }

  const nombre = formData.get('nombre') as string
  const apellido = formData.get('apellido') as string
  const cedula = formData.get('cedula') as string

  if (!nombre || !apellido || !cedula) {
    throw new Error('Nombre, apellido y cédula son obligatorios')
  }

  const payload = {
    numero_historia: historia,
    nombre,
    apellido,
    cedula,
    fecha_nacimiento: (formData.get('fecha_nacimiento') as string) || null,
    telefono: (formData.get('telefono') as string) || null,
    email: (formData.get('email') as string) || null,
    odontologo_id: (formData.get('odontologo_id') as string) || null,
  }

  const { data: newPaciente, error } = await supabase
    .from('pacientes')
    .insert(payload)
    .select('id')
    .single()

  if (error || !newPaciente) {
    if (error?.code === '23505') throw new Error('Ya existe un paciente con esa cédula')
    throw new Error(error?.message ?? 'Error creando paciente')
  }

  try {
    await registrarAuditLog({
      usuario_id: user.id,
      rol: profile.rol,
      accion: 'paciente.crear',
      entidad: 'pacientes',
      entidad_id: newPaciente.id,
      ip_address: ip,
      metadata: { numero_historia: historia, nombre, apellido },
    })
  } catch {
    // Audit log failure should not block the user
  }

  return { success: true, id: newPaciente.id }
}

export async function actualizarPacienteAction(pacienteId: string, formData: FormData) {
  const { user, profile, supabase } = await getCurrentUser()
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') ?? null

  const payload = {
    nombre: formData.get('nombre') as string,
    apellido: formData.get('apellido') as string,
    cedula: formData.get('cedula') as string,
    fecha_nacimiento: (formData.get('fecha_nacimiento') as string) || null,
    telefono: (formData.get('telefono') as string) || null,
    email: (formData.get('email') as string) || null,
    odontologo_id: (formData.get('odontologo_id') as string) || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('pacientes').update(payload).eq('id', pacienteId)
  if (error) throw new Error(error.message)

  await registrarAuditLog({
    usuario_id: user.id,
    rol: profile.rol,
    accion: 'paciente.actualizar',
    entidad: 'pacientes',
    entidad_id: pacienteId,
    ip_address: ip,
    metadata: payload,
  })

  redirect(`/pacientes/${pacienteId}`)
}
