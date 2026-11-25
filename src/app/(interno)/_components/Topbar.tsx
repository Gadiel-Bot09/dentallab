'use client'
// src/app/(interno)/_components/Topbar.tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { logoutAction } from '@/app/login/actions'
import type { Usuario } from '@/types/database'
import CrearInsumoRapidoModal from '@/components/modals/CrearInsumoRapidoModal'

interface TopbarProps {
  user: Pick<Usuario, 'nombre' | 'apellido' | 'rol' | 'email'>
  canCreateInsumo?: boolean
}

export default function Topbar({ user, canCreateInsumo = false }: TopbarProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [quickInsumoOpen, setQuickInsumoOpen] = useState(false)
  const router = useRouter()

  // Atajo global de teclado: Alt + N (o F2) para abrir "Registrar Nuevo Insumo en Catálogo"
  useEffect(() => {
    if (!canCreateInsumo) return

    function handleGlobalKeyDown(e: KeyboardEvent) {
      const isAltN = e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'n'
      const isF2 = e.key === 'F2' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey

      if (!isAltN && !isF2) return

      // Si el modal de Recepción Técnica está abierto, ese modal maneja el atajo directamente
      // para asociar el nuevo insumo automáticamente a la fila de la factura.
      if (document.querySelector('[data-recepcion-modal-open="true"]')) {
        return
      }

      e.preventDefault()
      setQuickInsumoOpen(true)
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [canCreateInsumo])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const term = searchTerm.trim().toUpperCase()
    if (term.startsWith('RAD-') || /RAD-\d{4}-\d{2}-\d{4}/.test(term)) {
      router.push(`/ordenes?radicado=${encodeURIComponent(term)}`)
    } else {
      router.push(`/ordenes?q=${encodeURIComponent(searchTerm.trim())}`)
    }
    setSearchTerm('')
  }

  const initials = `${user.nombre[0]}${user.apellido[0]}`.toUpperCase()

  return (
    <>
      <header className="h-16 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center gap-4 px-6 shrink-0">
        {/* Global Radicado Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
            <input
              id="global-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por radicado (RAD-YYYY-MM-NNNN)..."
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/50 transition-all"
            />
          </div>
        </form>

        <div className="flex-1" />

        {/* Acceso rápido + Atajo de teclado para Registrar Nuevo Insumo / Medicamento / Material */}
        {canCreateInsumo && (
          <button
            type="button"
            onClick={() => setQuickInsumoOpen(true)}
            title="Registrar Nuevo Insumo, Medicamento o Material (Atajo: Alt + N o F2)"
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/25 rounded-xl text-xs font-semibold transition-all"
          >
            <span>✨</span>
            <span>Nuevo Insumo</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-950/90 border border-sky-500/30 text-[10px] font-mono text-sky-400">
              Alt+N
            </kbd>
          </button>
        )}

        {/* User Menu */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white leading-tight">
              {user.nombre} {user.apellido}
            </p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <div
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm cursor-pointer
            hover:shadow-lg hover:shadow-sky-500/20 transition-all"
            title="Perfil"
            onClick={() => router.push('/perfil')}
          >
            {initials}
          </div>
          <button
            id="btn-logout"
            onClick={async () => { await logoutAction() }}
            className="text-slate-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-500/5"
            title="Cerrar sesión"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {canCreateInsumo && (
        <CrearInsumoRapidoModal
          isOpen={quickInsumoOpen}
          onClose={() => setQuickInsumoOpen(false)}
          onCreated={(created) => {
            toast.success(`Registrado: ${created.codigo} — ${created.nombre}`)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
