'use client'
// src/app/(externo)/_components/ExternoNavbar.tsx
import { logoutAction } from '@/app/login/actions'

export default function ExternoNavbar({
  user,
  labNombre,
}: {
  user: { nombre: string; apellido: string; email: string }
  labNombre: string
}) {
  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-4 py-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <span className="text-lg">🔬</span>
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">{labNombre}</p>
            <p className="text-slate-500 text-xs">Portal Laboratorio · DentalLab Manager</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white leading-tight">
              {user.nombre} {user.apellido}
            </p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <button
            id="btn-logout-externo"
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
      </div>
    </nav>
  )
}
