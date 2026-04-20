// src/lib/audit/logger.ts
// Central helper for recording all audit events.
// RULE: Every mutation in the system MUST call this function.
import { createAdminClient } from '@/lib/supabase/server'

interface AuditLogInput {
  usuario_id: string
  rol: string
  accion: string
  entidad: string
  entidad_id: string
  ip_address?: string | null
  metadata?: Record<string, unknown>
}

export async function registrarAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const supabase = await createAdminClient()
    const { error } = await supabase.from('audit_logs').insert({
      usuario_id: input.usuario_id,
      rol: input.rol,
      accion: input.accion,
      entidad: input.entidad,
      entidad_id: input.entidad_id,
      ip_address: input.ip_address ?? null,
      metadata: input.metadata ?? {},
    })
    if (error) {
      console.error('[AUDIT] Error al registrar log:', error.message)
    }
  } catch (err) {
    console.error('[AUDIT] Excepción al registrar log:', err)
  }
}
