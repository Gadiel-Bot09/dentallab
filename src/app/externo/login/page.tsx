// src/app/externo/login/page.tsx
import { Suspense } from 'react'
import LoginForm from '@/app/login/_components/LoginForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Portal Laboratorio — DentalLab Manager',
  description: 'Acceso al portal externo para laboratorios',
}

export default function ExternoLoginPage() {
  const portalActivo = process.env.NEXT_PUBLIC_PORTAL_EXTERNO_ACTIVO === 'true' || true // Temp bypass for dev

  if (!portalActivo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="max-w-md mx-auto text-center px-4">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-white mb-2">Portal Deshabilitado</h1>
          <p className="text-slate-400 text-sm mb-6">
            El portal externo de laboratorios no está habilitado actualmente. Contacta al administrador del sistema.
          </p>
          <a href="/login" className="text-sky-400 hover:text-sky-300 text-sm transition-colors">
            ← Ir al portal interno
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-48 -right-48 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
      </div>

      <div className="relative w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 mb-4 shadow-lg shadow-violet-500/25">
            <span className="text-3xl">🔬</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Portal Laboratorio</h1>
          <p className="mt-2 text-slate-400 text-sm">DentalLab Manager · Acceso externo</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl shadow-black/40">
          <h2 className="text-xl font-semibold text-white mb-1">Acceso al Portal</h2>
          <p className="text-slate-400 text-sm mb-6">
            Ingresa tus credenciales para ver y gestionar tus órdenes asignadas.
          </p>
          <Suspense fallback={null}>
            <LoginForm isExterno={true} />
          </Suspense>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          ¿Eres del centro dental?{' '}
          <a href="/login" className="text-sky-400 hover:text-sky-300 transition-colors">
            Portal interno →
          </a>
        </p>
      </div>
    </div>
  )
}
