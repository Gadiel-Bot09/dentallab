// src/proxy.ts
// Renamed from middleware.ts — Next.js v16 uses proxy.ts with exported `proxy` function
import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'
import type { UserRol } from '@/types/database'

const INTERNAL_ROLES: UserRol[] = ['admin', 'odontologo', 'auxiliar', 'recepcionista']
const EXTERNAL_ROLES: UserRol[] = ['laboratorio']

const ROLE_HOME: Record<UserRol, string> = {
  admin: '/dashboard',
  odontologo: '/dashboard',
  auxiliar: '/dashboard',
  recepcionista: '/dashboard',
  laboratorio: '/externo/ordenes',
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { supabaseResponse, user } = await updateSession(request)

  // ── Public routes — no auth needed
  const publicPaths = ['/login', '/externo/login', '/auth/callback']
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return supabaseResponse
  }

  // ── Not authenticated
  if (!user) {
    const loginUrl = pathname.startsWith('/externo')
      ? new URL('/externo/login', request.url)
      : new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── Get user profile with rol
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    }
  )

  const { data: profile } = await supabase
    .from('usuarios')
    .select('rol, activo, laboratorio_id')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'usuario_inactivo')
    return NextResponse.redirect(loginUrl)
  }

  const userRol: UserRol = profile.rol

  // ── External portal guard
  if (pathname.startsWith('/externo')) {
    const portalActivo = process.env.NEXT_PUBLIC_PORTAL_EXTERNO_ACTIVO === 'true'
    if (!portalActivo) return NextResponse.redirect(new URL('/login', request.url))
    if (!EXTERNAL_ROLES.includes(userRol)) return NextResponse.redirect(new URL('/dashboard', request.url))
    return supabaseResponse
  }

  // ── Internal portal guard
  if (!INTERNAL_ROLES.includes(userRol)) {
    return NextResponse.redirect(new URL('/externo/ordenes', request.url))
  }

  // ── Admin-only routes
  const adminOnlyPaths = ['/usuarios', '/reportes/auditoria']
  if (adminOnlyPaths.some((p) => pathname.startsWith(p)) && userRol !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard?error=sin_permiso', request.url))
  }

  // ── Root redirect
  if (pathname === '/') {
    return NextResponse.redirect(new URL(ROLE_HOME[userRol], request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
