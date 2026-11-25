// src/app/(interno)/layout.tsx
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getUserAuthContext } from '@/lib/rbac-server'
import Sidebar from './_components/Sidebar'
import Topbar from './_components/Topbar'

export default async function InternoLayout({ children }: { children: ReactNode }) {
  const ctx = await getUserAuthContext()
  if (!ctx || !ctx.activo) redirect('/login')

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <Sidebar
        userRol={ctx.rol}
        rolNombre={ctx.rolNombre}
        rolColor={ctx.rolColor}
        permisos={ctx.permisos}
        isAdmin={ctx.isAdmin}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          user={{
            nombre: ctx.nombre,
            apellido: ctx.apellido,
            rol: ctx.rol,
            email: ctx.email,
          }}
          canCreateInsumo={ctx.canAny(['inventario.gestionar', 'farmacia.recepcion_registrar'])}
        />
        <main className="flex-1 overflow-y-auto bg-slate-950 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
