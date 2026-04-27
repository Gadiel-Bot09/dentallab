import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    template: '%s — DentalLab Manager',
    default: 'DentalLab Manager',
  },
  applicationName: 'DentalLab Manager',
  description:
    'Sistema de Gestión Protésica para centros odontológicos. Gestiona órdenes de servicio, inventario, laboratorios y trazabilidad completa.',
  keywords: ['odontología', 'prótesis dental', 'laboratorio dental', 'gestión odontológica'],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950">{children}</body>
    </html>
  )
}
