// src/lib/resend/client.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@mail.sinuhub.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
}

async function sendEmail({ to, subject, html }: SendEmailOptions) {
  const { error } = await resend.emails.send({
    from: `DentalLab Manager <${FROM}>`,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  })
  if (error) {
    console.error('[RESEND] Error enviando correo:', error)
  }
}

// ─── Email Templates ──────────────────────────────────────────────────────────

function baseTemplate(content: string, radicado: string): string {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DentalLab Manager</title></head>
  <body style="font-family: Inter, Arial, sans-serif; background:#f8fafc; margin:0; padding:20px;">
    <div style="max-width:600px; margin:auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#0ea5e9,#6366f1); padding:28px 32px;">
        <h1 style="color:#fff; margin:0; font-size:22px; font-weight:700;">🦷 DentalLab Manager</h1>
        <p style="color:rgba(255,255,255,0.85); margin:6px 0 0; font-size:14px;">Sistema de Gestión Protésica</p>
      </div>
      <div style="padding:32px;">
        ${content}
        <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;">
        <p style="color:#94a3b8; font-size:12px; margin:0;">
          Radicado de referencia: <strong style="color:#475569;">${radicado}</strong><br>
          <a href="${APP_URL}" style="color:#0ea5e9;">Ir al sistema</a>
        </p>
      </div>
    </div>
  </body></html>`
}

// 1. Orden enviada al laboratorio
export async function emailOrdenEnviadaLab({
  to,
  radicado,
  tipoTrabajo,
  pacienteNombre,
  odontologoNombre,
  linkOrden,
}: {
  to: string
  radicado: string
  tipoTrabajo: string
  pacienteNombre: string
  odontologoNombre: string
  linkOrden: string
}) {
  const content = `
    <h2 style="color:#1e293b; margin-bottom:8px;">📦 Nueva Orden Asignada</h2>
    <p style="color:#475569;">Se le ha asignado una nueva orden de servicio para fabricación.</p>
    <div style="background:#f1f5f9; border-radius:8px; padding:20px; margin:20px 0;">
      <p style="margin:4px 0; color:#334155;"><strong>Radicado:</strong> ${radicado}</p>
      <p style="margin:4px 0; color:#334155;"><strong>Tipo de trabajo:</strong> ${tipoTrabajo}</p>
      <p style="margin:4px 0; color:#334155;"><strong>Paciente:</strong> ${pacienteNombre}</p>
      <p style="margin:4px 0; color:#334155;"><strong>Odontólogo:</strong> ${odontologoNombre}</p>
    </div>
    <a href="${linkOrden}" style="display:inline-block; background:#0ea5e9; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">
      Ver Orden en el Portal
    </a>`
  await sendEmail({ to, subject: `[${radicado}] Nueva Orden Asignada - DentalLab Manager`, html: baseTemplate(content, radicado) })
}

// 2. Lab confirma recepción → notifica al odontólogo
export async function emailLaboratorioConfirmoRecepcion({
  to,
  radicado,
  tipoTrabajo,
  labNombre,
  fechaEstimada,
}: {
  to: string | string[]
  radicado: string
  tipoTrabajo: string
  labNombre: string
  fechaEstimada?: string
}) {
  const content = `
    <h2 style="color:#1e293b; margin-bottom:8px;">✅ Laboratorio Confirmó Recepción</h2>
    <p style="color:#475569;">El laboratorio ha confirmado la recepción del trabajo y está en proceso.</p>
    <div style="background:#f1f5f9; border-radius:8px; padding:20px; margin:20px 0;">
      <p style="margin:4px 0; color:#334155;"><strong>Radicado:</strong> ${radicado}</p>
      <p style="margin:4px 0; color:#334155;"><strong>Trabajo:</strong> ${tipoTrabajo}</p>
      <p style="margin:4px 0; color:#334155;"><strong>Laboratorio:</strong> ${labNombre}</p>
      ${fechaEstimada ? `<p style="margin:4px 0; color:#334155;"><strong>Entrega estimada:</strong> ${fechaEstimada}</p>` : ''}
    </div>`
  await sendEmail({ to, subject: `[${radicado}] Lab Confirmó Recepción - DentalLab Manager`, html: baseTemplate(content, radicado) })
}

// 3. Orden lista en laboratorio → alerta urgente al auxiliar
export async function emailOrdenListaEnLab({
  to,
  radicado,
  tipoTrabajo,
  labNombre,
  linkOrden,
}: {
  to: string | string[]
  radicado: string
  tipoTrabajo: string
  labNombre: string
  linkOrden: string
}) {
  const content = `
    <h2 style="color:#dc2626; margin-bottom:8px;">🚨 ¡Orden Lista para Recoger!</h2>
    <p style="color:#475569;">El laboratorio ha marcado la orden como <strong>LISTA</strong>. Por favor recójanla a la brevedad.</p>
    <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:20px; margin:20px 0;">
      <p style="margin:4px 0; color:#334155;"><strong>Radicado:</strong> ${radicado}</p>
      <p style="margin:4px 0; color:#334155;"><strong>Trabajo:</strong> ${tipoTrabajo}</p>
      <p style="margin:4px 0; color:#334155;"><strong>Laboratorio:</strong> ${labNombre}</p>
    </div>
    <a href="${linkOrden}" style="display:inline-block; background:#dc2626; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">
      Ver Orden Urgente
    </a>`
  await sendEmail({ to, subject: `⚡ [${radicado}] LISTA PARA RECOGER - DentalLab Manager`, html: baseTemplate(content, radicado) })
}

// 4. Alerta de orden tardía (para cron)
export async function emailOrdenDemorada({
  to,
  radicado,
  tipoTrabajo,
  labNombre,
  fechaEstimada,
  diasDemora,
}: {
  to: string | string[]
  radicado: string
  tipoTrabajo: string
  labNombre: string
  fechaEstimada: string
  diasDemora: number
}) {
  const content = `
    <h2 style="color:#f59e0b; margin-bottom:8px;">⚠️ Orden con Demora</h2>
    <p style="color:#475569;">La siguiente orden superó su fecha de entrega estimada y no ha sido actualizada.</p>
    <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:20px; margin:20px 0;">
      <p style="margin:4px 0; color:#334155;"><strong>Radicado:</strong> ${radicado}</p>
      <p style="margin:4px 0; color:#334155;"><strong>Trabajo:</strong> ${tipoTrabajo}</p>
      <p style="margin:4px 0; color:#334155;"><strong>Laboratorio:</strong> ${labNombre}</p>
      <p style="margin:4px 0; color:#dc2626;"><strong>Fecha prometida:</strong> ${fechaEstimada} (${diasDemora} día(s) de retraso)</p>
    </div>`
  await sendEmail({ to, subject: `⚠️ [${radicado}] Orden Demorada - DentalLab Manager`, html: baseTemplate(content, radicado) })
}

// 5. Alerta de stock bajo (para cron semanal)
export async function emailStockBajo({
  to,
  materiales,
}: {
  to: string | string[]
  materiales: Array<{ nombre: string; stock_actual: number; stock_minimo: number; unidad_medida: string }>
}) {
  const rows = materiales
    .map(
      (m) =>
        `<tr>
          <td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">${m.nombre}</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; color:#dc2626; font-weight:700;">${m.stock_actual} ${m.unidad_medida}</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; color:#64748b;">${m.stock_minimo} ${m.unidad_medida}</td>
        </tr>`
    )
    .join('')

  const content = `
    <h2 style="color:#f59e0b; margin-bottom:8px;">📊 Alerta de Stock Bajo</h2>
    <p style="color:#475569;">Los siguientes materiales están por debajo del stock mínimo configurado.</p>
    <table style="width:100%; border-collapse:collapse; margin-top:16px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="text-align:left; padding:8px 12px; font-weight:600; color:#475569;">Material</th>
          <th style="text-align:left; padding:8px 12px; font-weight:600; color:#475569;">Stock Actual</th>
          <th style="text-align:left; padding:8px 12px; font-weight:600; color:#475569;">Stock Mínimo</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
  await sendEmail({ to, subject: `📊 Alerta Stock Bajo - DentalLab Manager`, html: baseTemplate(content, 'INVENTARIO') })
}
