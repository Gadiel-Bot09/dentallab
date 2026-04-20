// src/app/api/documentos/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uploadFile, MINIO_BUCKET, buildOrdenDocKey } from '@/lib/minio/client'
import { registrarAuditLog } from '@/lib/audit/logger'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('usuarios')
      .select('id, nombre, apellido, rol')
      .eq('id', user.id)
      .single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const ordenId = formData.get('orden_id') as string
    const categoria = (formData.get('categoria') as string) || 'otro'
    const descripcion = formData.get('descripcion') as string

    if (!file || !ordenId) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Archivo demasiado grande (máx 10MB)' }, { status: 400 })
    }

    // Verify order exists and user has access
    const { data: orden } = await supabase
      .from('ordenes_servicio')
      .select('id, radicado, laboratorio_id')
      .eq('id', ordenId)
      .single()

    if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const key = buildOrdenDocKey(ordenId, categoria, file.name)

    await uploadFile({
      bucket: MINIO_BUCKET,
      key,
      buffer,
      mimeType: file.type,
      size: file.size,
    })

    const { data: docRecord, error: dbError } = await supabase
      .from('documentos_orden')
      .insert({
        orden_id: ordenId,
        nombre_archivo: file.name,
        tipo_archivo: file.type,
        tamaño_bytes: file.size,
        minio_bucket: MINIO_BUCKET,
        minio_key: key,
        descripcion: descripcion || file.name,
        categoria,
        subido_por_id: user.id,
      })
      .select('id')
      .single()

    if (dbError) throw dbError

    // Register event
    await supabase.from('eventos_orden').insert({
      orden_id: ordenId,
      tipo_evento: 'documento_adjunto',
      descripcion: `Documento "${file.name}" subido por ${profile.nombre} ${profile.apellido}`,
      actor_id: user.id,
      actor_rol: profile.rol,
      modo: profile.rol === 'laboratorio' ? 'portal_externo' : 'gestion_interna',
      metadata: { archivo: file.name, categoria, tamaño: file.size },
    })

    await registrarAuditLog({
      usuario_id: user.id,
      rol: profile.rol,
      accion: 'documento.subir',
      entidad: 'documentos_orden',
      entidad_id: docRecord?.id ?? ordenId,
      metadata: { orden_id: ordenId, archivo: file.name, categoria },
    })

    return NextResponse.json({ id: docRecord?.id, key })
  } catch (err) {
    console.error('[DOC UPLOAD]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
