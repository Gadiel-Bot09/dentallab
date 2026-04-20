// src/app/api/documentos/[id]/presigned/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPresignedUrl } from '@/lib/minio/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params

    const { data: doc } = await supabase
      .from('documentos_orden')
      .select('minio_bucket, minio_key, orden_id')
      .eq('id', id)
      .single()

    if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

    const url = await getPresignedUrl(doc.minio_bucket, doc.minio_key)
    return NextResponse.json({ url })
  } catch (err) {
    console.error('[PRESIGN]', err)
    return NextResponse.json({ error: 'Error generando URL' }, { status: 500 })
  }
}
