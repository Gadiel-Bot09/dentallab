'use server'
// src/app/(interno)/categorias-inventario/actions.ts
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearCategoriaAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')

  const nombre = formData.get('nombre') as string
  const descripcion = formData.get('descripcion') as string

  if (!nombre) throw new Error('El nombre es requerido')

  const { error } = await supabase.from('categorias_inventario').insert({
    nombre,
    descripcion,
  })

  if (error) {
    if (error.code === '23505') throw new Error('Esta categoría ya existe.')
    throw new Error(error.message)
  }

  revalidatePath('/categorias-inventario')
  revalidatePath('/inventario/nuevo')
}

export async function toggleCategoriaAction(id: string, activa: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('categorias_inventario')
    .update({ activa })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/categorias-inventario')
  revalidatePath('/inventario/nuevo')
}

export async function eliminarCategoriaAction(id: string) {
  const supabase = await createClient()

  // Verificar si hay materiales con esta categoría
  const { count, error: countError } = await supabase
    .from('inventario')
    .select('*', { count: 'exact', head: true })
    .eq('categoria_id', id)

  if (countError) throw new Error(countError.message)
  if (count && count > 0) {
    throw new Error('No se puede eliminar: Hay materiales usando esta categoría. Te sugerimos desactivarla en su lugar.')
  }

  const { error } = await supabase.from('categorias_inventario').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/categorias-inventario')
  revalidatePath('/inventario/nuevo')
}
