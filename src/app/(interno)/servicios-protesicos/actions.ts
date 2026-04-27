'use server'
// src/app/(interno)/servicios-protesicos/actions.ts
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearServicioAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')

  const nombre = formData.get('nombre') as string
  const descripcion = formData.get('descripcion') as string

  if (!nombre) throw new Error('El nombre es requerido')

  const { error } = await supabase.from('servicios_protesicos').insert({
    nombre,
    descripcion,
  })

  if (error) {
    if (error.code === '23505') throw new Error('Este servicio ya existe.')
    throw new Error(error.message)
  }

  revalidatePath('/servicios-protesicos')
  revalidatePath('/ordenes/nueva')
}

export async function toggleServicioAction(id: string, activo: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('servicios_protesicos')
    .update({ activo })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/servicios-protesicos')
  revalidatePath('/ordenes/nueva')
}

export async function eliminarServicioAction(id: string) {
  const supabase = await createClient()

  // Obtener el nombre para buscar en órdenes
  const { data: servicio } = await supabase
    .from('servicios_protesicos')
    .select('nombre')
    .eq('id', id)
    .single()

  if (!servicio) throw new Error('Servicio no encontrado')

  // Verificar si hay órdenes activas con este servicio
  const { count, error: countError } = await supabase
    .from('ordenes_servicio')
    .select('*', { count: 'exact', head: true })
    .eq('tipo_trabajo', servicio.nombre)
    .not('estado', 'in', '("entregada","cancelada")')

  if (countError) throw new Error(countError.message)
  if (count && count > 0) {
    throw new Error('No se puede eliminar: Hay órdenes activas en proceso usando este servicio.')
  }

  // Eliminar
  const { error } = await supabase.from('servicios_protesicos').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/servicios-protesicos')
  revalidatePath('/ordenes/nueva')
}
