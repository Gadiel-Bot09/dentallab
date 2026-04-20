'use client'
// src/app/(interno)/ordenes/[id]/_components/DocumentosPanel.tsx
import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Documento {
  id: string
  nombre_archivo: string
  tipo_archivo: string
  tamaño_bytes: number
  minio_bucket: string
  minio_key: string
  descripcion: string | null
  categoria: string | null
  created_at: string
  usuarios?: { nombre: string; apellido: string } | null
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function DocumentosPanel({
  documentos,
  ordenId,
}: {
  documentos: Documento[]
  ordenId: string
}) {
  const [uploading, setUploading] = useState(false)
  const [categoria, setCategoria] = useState('foto_trabajo')

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo supera 10 MB. Por favor selecciona un archivo más pequeño.')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.set('file', file)
      fd.set('orden_id', ordenId)
      fd.set('categoria', categoria)
      fd.set('descripcion', file.name)

      const res = await fetch('/api/documentos/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Error al subir el archivo')
      window.location.reload()
    } catch (err) {
      alert('Error al subir el archivo. Intenta de nuevo.')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  async function handleView(docId: string) {
    const res = await fetch(`/api/documentos/${docId}/presigned`)
    if (res.ok) {
      const { url } = await res.json()
      window.open(url, '_blank')
    } else {
      alert('No se pudo generar el enlace de vista previa')
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <h2 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Documentos Adjuntos</h2>

      {/* Upload */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
        >
          <option value="foto_trabajo">Foto del trabajo</option>
          <option value="guia_remision">Guía de remisión</option>
          <option value="especificacion">Especificación técnica</option>
          <option value="otro">Otro</option>
        </select>

        <label className={`cursor-pointer px-4 py-2 border rounded-xl text-sm font-medium transition-all ${uploading ? 'border-slate-700 text-slate-600 cursor-not-allowed' : 'border-sky-500/40 text-sky-400 hover:bg-sky-500/10'}`}>
          {uploading ? 'Subiendo...' : '📎 Adjuntar archivo'}
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
            id="file-upload"
          />
        </label>
        <p className="text-slate-600 text-xs self-center">PDF, JPG, PNG, WEBP · Máx. 10MB</p>
      </div>

      {documentos.length === 0 ? (
        <p className="text-slate-600 text-sm text-center py-6">No hay documentos adjuntos</p>
      ) : (
        <div className="space-y-2">
          {documentos.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between bg-slate-800/60 rounded-xl px-4 py-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl shrink-0">
                  {doc.tipo_archivo.includes('pdf') ? '📄' : doc.tipo_archivo.includes('image') ? '🖼️' : '📎'}
                </span>
                <div className="min-w-0">
                  <p className="text-slate-300 text-sm font-medium truncate">{doc.nombre_archivo}</p>
                  <p className="text-slate-500 text-xs">
                    {doc.categoria} · {formatSize(doc.tamaño_bytes)} ·{' '}
                    {format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: es })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleView(doc.id)}
                className="shrink-0 text-xs text-sky-400 hover:text-sky-300 transition-colors px-3 py-1.5 border border-sky-500/20 rounded-lg hover:bg-sky-500/10"
              >
                Ver →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
