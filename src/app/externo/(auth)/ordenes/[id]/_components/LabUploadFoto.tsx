'use client'
// src/app/(externo)/ordenes/[id]/_components/LabUploadFoto.tsx
import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Documento {
  id: string
  nombre_archivo: string
  tipo_archivo: string
  tamaño_bytes: number
  categoria: string | null
  created_at: string
}

export default function LabUploadFoto({
  ordenId,
  documentos,
}: {
  ordenId: string
  documentos: Documento[]
}) {
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(documentos)

  function fmtSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      alert('Imagen demasiado grande (máx. 10MB)')
      return
    }

    setUploading(true)
    try {
      const fd = new FormData()
      fd.set('file', file)
      fd.set('orden_id', ordenId)
      fd.set('categoria', 'foto_trabajo')
      fd.set('descripcion', `Foto del trabajo - ${file.name}`)

      const res = await fetch('/api/documentos/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const errorData = await res.json()
        alert(`Error: ${errorData.error}`)
        return
      }

      // Refresh list
      setUploaded((prev) => [
        ...prev,
        { id: Date.now().toString(), nombre_archivo: file.name, tipo_archivo: file.type, tamaño_bytes: file.size, categoria: 'foto_trabajo', created_at: new Date().toISOString() },
      ])
    } catch (err) {
      alert('Error al subir la imagen')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleView(docId: string) {
    const res = await fetch(`/api/documentos/${docId}/presigned`)
    if (res.ok) {
      const { url } = await res.json()
      window.open(url, '_blank')
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <h2 className="font-semibold text-white text-sm">📸 Fotos del Trabajo</h2>

      {/* Upload button — large touch target for mobile lab techs */}
      <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
        uploading
          ? 'border-slate-700 bg-slate-800/30 cursor-not-allowed'
          : 'border-violet-500/40 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-400/60'
      }`}>
        <span className="text-3xl mb-1">{uploading ? '⏳' : '📷'}</span>
        <p className="text-sm text-slate-400">{uploading ? 'Subiendo...' : 'Toca para subir foto'}</p>
        <p className="text-xs text-slate-600 mt-0.5">JPG, PNG, WEBP · máx. 10MB</p>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
          id="lab-photo-upload"
        />
      </label>

      {/* Photos list */}
      {uploaded.filter((d) => d.tipo_archivo.startsWith('image')).length > 0 ? (
        <div className="space-y-2">
          {uploaded
            .filter((d) => d.tipo_archivo.startsWith('image'))
            .map((doc) => (
              <button
                key={doc.id}
                onClick={() => handleView(doc.id)}
                className="w-full flex items-center gap-3 bg-slate-800/60 rounded-xl px-4 py-3 text-left hover:bg-slate-800 transition-colors"
              >
                <span className="text-2xl">🖼️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300 text-sm truncate">{doc.nombre_archivo}</p>
                  <p className="text-slate-500 text-xs">
                    {fmtSize(doc.tamaño_bytes)} · {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </p>
                </div>
                <span className="text-slate-500 text-xs shrink-0">Ver →</span>
              </button>
            ))}
        </div>
      ) : (
        <p className="text-slate-600 text-xs text-center">No hay fotos subidas aún</p>
      )}
    </div>
  )
}
