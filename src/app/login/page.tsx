// src/app/login/page.tsx
import { Suspense } from 'react'
import LoginForm from './_components/LoginForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Iniciar Sesión — DentalLab Manager',
  description: 'Portal de gestión protésica para centros odontológicos',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">
      {/* Animated background gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-48 -left-48 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-48 -right-48 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px),linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative w-full max-w-md px-4">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="DentalLab Manager" className="h-16 w-auto mx-auto mb-4" />
          <p className="mt-2 text-slate-400 text-sm">Sistema de Gestión Protésica</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl shadow-black/40">
          <h2 className="text-xl font-semibold text-white mb-1">Bienvenido</h2>
          <p className="text-slate-400 text-sm mb-6">Ingresa tus credenciales para acceder al portal interno.</p>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          ¿Eres laboratorio?{' '}
          <a href="/externo/login" className="text-sky-400 hover:text-sky-300 transition-colors">
            Accede aquí →
          </a>
        </p>
      </div>
    </div>
  )
}
