'use client'
// src/app/(interno)/_components/Sidebar.tsx
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type UserRol, ROL_LABELS } from '@/types/database'
import {
  ROL_COLOR_STYLES,
  type PermisoCodigo,
  type RolColor,
} from '@/lib/rbac'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: string
  permisos?: PermisoCodigo[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊', permisos: ['dashboard.ver'] },
  { href: '/solicitudes', label: 'Solicitudes Insumos', icon: '📝', permisos: ['solicitudes.ver', 'solicitudes.crear'] },
  { href: '/devoluciones', label: 'Devoluciones', icon: '↩️', permisos: ['devoluciones.ver', 'devoluciones.crear', 'devoluciones.confirmar'] },
  { href: '/farmacia/stock', label: 'Stock Farmacia', icon: '💊', permisos: ['farmacia.stock_ver', 'farmacia.recepcion_registrar'] },
  { href: '/farmacia/kardex', label: 'Kardex Farmacia', icon: '📜', permisos: ['farmacia.kardex_ver'] },
  { href: '/farmacia/reportes', label: 'Indicadores Farmacia', icon: '📉', permisos: ['farmacia.reportes_ver'] },
  { href: '/areas', label: 'Áreas Institución', icon: '🏢', permisos: ['areas.gestionar'] },
  { href: '/farmacias', label: 'Farmacias / Bodegas', icon: '🏥', permisos: ['farmacias.gestionar'] },
  { href: '/ordenes', label: 'Órdenes Prótesis', icon: '🦷', permisos: ['ordenes.ver', 'ordenes.crear'] },
  { href: '/pacientes', label: 'Pacientes', icon: '🧑‍⚕️', permisos: ['pacientes.ver', 'pacientes.gestionar'] },
  { href: '/inventario', label: 'Inventario Lab', icon: '📦', permisos: ['inventario.ver', 'inventario.gestionar'] },
  { href: '/laboratorios', label: 'Clínicas/Lab', icon: '🔬', permisos: ['clinica.directorio'] },
  { href: '/odontologos', label: 'Odontólogos', icon: '👨‍⚕️', permisos: ['clinica.directorio'] },
  { href: '/especialidades', label: 'Especialidades', icon: '⚕️', permisos: ['catalogos.gestionar'] },
  { href: '/servicios-protesicos', label: 'Servicios Protésicos', icon: '🛠️', permisos: ['catalogos.gestionar'] },
  { href: '/categorias-inventario', label: 'Cat. Inventario', icon: '🗂️', permisos: ['catalogos.gestionar'] },
  { href: '/unidades-medida', label: 'Unidades Medida', icon: '⚖️', permisos: ['catalogos.gestionar'] },
  { href: '/reportes', label: 'Reportes Lab', icon: '📈', permisos: ['reportes.lab_ver'] },
  { href: '/usuarios', label: 'Usuarios y Roles', icon: '🛡️', permisos: ['usuarios.ver', 'usuarios.gestionar', 'roles.gestionar'] },
]

export default function Sidebar({
  userRol,
  rolNombre,
  rolColor = 'sky',
  permisos = [],
  isAdmin = false,
}: {
  userRol: UserRol
  rolNombre?: string
  rolColor?: RolColor
  permisos?: PermisoCodigo[]
  isAdmin?: boolean
}) {
  const pathname = usePathname()
  const permSet = new Set<PermisoCodigo>(permisos)
  const badgeStyle = ROL_COLOR_STYLES[rolColor] || ROL_COLOR_STYLES.sky

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (isAdmin) return true
    if (!item.permisos || item.permisos.length === 0) return true
    return item.permisos.some((p) => permSet.has(p))
  })

  return (
    <aside className="hidden md:flex md:flex-col w-64 bg-slate-900 border-r border-slate-800 shrink-0">
      {/* Brand */}
      <div className="flex items-center justify-center px-4 py-5 border-b border-slate-800">
        <img src="/logo.svg" alt="DentalLab Manager" className="h-9 w-auto" />
      </div>

      {/* Role badge */}
      <div className="px-4 py-3 border-b border-slate-800">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${badgeStyle.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${badgeStyle.dot}`} />
          {rolNombre || ROL_LABELS[userRol]}
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
