// src/lib/minio/client.ts
import * as Minio from 'minio'

let minioClientInstance: Minio.Client | null = null

export function getMinioClient(): Minio.Client {
  if (minioClientInstance) return minioClientInstance

  minioClientInstance = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT!,
    port: parseInt(process.env.MINIO_PORT ?? '443'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY!,
    secretKey: process.env.MINIO_SECRET_KEY!,
  })

  return minioClientInstance
}

export const MINIO_BUCKET = process.env.MINIO_BUCKET ?? 'dentallab'

// ─── Upload file buffer ───────────────────────────────────────────────────────
export async function uploadFile({
  bucket,
  key,
  buffer,
  mimeType,
  size,
}: {
  bucket: string
  key: string
  buffer: Buffer
  mimeType: string
  size: number
}): Promise<void> {
  const client = getMinioClient()
  await client.putObject(bucket, key, buffer, size, { 'Content-Type': mimeType })
}

// ─── Generate presigned read URL (expires in 1 hour) ─────────────────────────
export async function getPresignedUrl(bucket: string, key: string): Promise<string> {
  const client = getMinioClient()
  return client.presignedGetObject(bucket, key, 60 * 60) // 1 hour
}

// ─── Delete file (archive only — call explicitly for admin) ──────────────────
export async function deleteFile(bucket: string, key: string): Promise<void> {
  const client = getMinioClient()
  await client.removeObject(bucket, key)
}

// ─── Check if bucket exists, create if not ───────────────────────────────────
export async function ensureBucketExists(bucket: string): Promise<void> {
  const client = getMinioClient()
  const exists = await client.bucketExists(bucket)
  if (!exists) {
    await client.makeBucket(bucket, 'us-east-1')
  }
}

// ─── Build the MinIO key for an order document ───────────────────────────────
export function buildOrdenDocKey(
  ordenId: string,
  categoria: string,
  fileName: string
): string {
  return `ordenes/${ordenId}/${categoria}/${Date.now()}_${fileName}`
}
