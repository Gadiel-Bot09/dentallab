'use server'
// src/app/(interno)/unidades-medida/actions.ts
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearUnidadAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')

  const nombre = formData.get('nombre') as string
  const abreviatura = formData.get('abreviatura') as string

  if (!nombre) throw new Error('El nombre es requerido')

  const { error } = await supabase.from('unidades_medida').insert({
    nombre,
    abreviatura: abreviatura || null,
  })

  if (error) {
    if (error.code === '23505') throw new Error('Esta unidad ya existe.')
    throw new Error(error.message)
  }

  revalidatePath('/unidades-medida')
  revalidatePath('/inventario/nuevo')
}

export async function toggleUnidadAction(id: string, activa: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('unidades_medida')
    .update({ activa })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/unidades-medida')
  revalidatePath('/inventario/nuevo')
}

export async function eliminarUnidadAction(id: string) {
  const supabase = await createClient()

  const { count, error: countError } = await supabase
    .from('inventario')
    .select('*', { count: 'exact', head: true })
    .eq('unidad_medida_id', id)

  if (countError) throw new Error(countError.message)
  if (count && count > 0) {
    throw new Error('No se puede eliminar: Hay materiales usando esta unidad. Desactívala en su lugar.')
  }

  const { error } = await supabase.from('unidades_medida').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/unidades-medida')
  revalidatePath('/inventario/nuevo')
}
