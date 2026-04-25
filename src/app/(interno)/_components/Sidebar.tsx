'use client'
// src/app/(interno)/_components/Sidebar.tsx
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type UserRol, ROL_LABELS } from '@/types/database'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: string
  roles?: UserRol[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/ordenes', label: 'Órdenes', icon: '📋' },
  { href: '/pacientes', label: 'Pacientes', icon: '🧑‍⚕️' },
  { href: '/inventario', label: 'Inventario', icon: '📦' },
  { href: '/laboratorios', label: 'Clínicas/Lab', icon: '🔬', roles: ['admin', 'auxiliar', 'recepcionista'] },
  { href: '/odontologos', label: 'Odontólogos', icon: '🦷', roles: ['admin', 'auxiliar', 'recepcionista'] },
  { href: '/especialidades', label: 'Especialidades', icon: '⚕️', roles: ['admin'] },
  { href: '/reportes', label: 'Reportes', icon: '📈', roles: ['admin', 'odontologo'] },
  { href: '/usuarios', label: 'Usuarios', icon: '👥', roles: ['admin'] },
]

export default function Sidebar({ userRol }: { userRol: UserRol }) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(userRol)
  )

  return (
    <aside className="hidden md:flex md:flex-col w-64 bg-slate-900 border-r border-slate-800 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 shrink-0">
          <span className="text-lg">🦷</span>
        </div>
        <div className="min-w-0">
          <p className="font-bold text-white text-sm leading-tight truncate">DentalLab</p>
          <p className="text-slate-500 text-xs truncate">Manager</p>
        </div>
      </div>

      {/* Role badge */}
      <div className="px-4 py-3 border-b border-slate-800">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-500/10 text-sky-400 rounded-lg text-xs font-medium border border-sky-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
          {ROL_LABELS[userRol]}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-gradient-to-r from-sky-500/20 to-indigo-500/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-800">
        <p className="text-slate-600 text-xs text-center">v1.0.0 · Colombia 🇨🇴</p>
      </div>
    </aside>
  )
}
