// src/app/(interno)/dashboard/_components/StatCard.tsx
import Link from 'next/link'
import { cn } from '@/lib/utils'

const colorMap = {
  sky: 'from-sky-500/20 to-sky-500/5 border-sky-500/20 text-sky-400',
  red: 'from-red-500/20 to-red-500/5 border-red-500/20 text-red-400',
  emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
  violet: 'from-violet-500/20 to-violet-500/5 border-violet-500/20 text-violet-400',
}

interface StatCardProps {
  id: string
  label: string
  value: string
  icon: string
  color: keyof typeof colorMap
  href: string
  detail: string
}

export default function StatCard({ id, label, value, icon, color, href, detail }: StatCardProps) {
  return (
    <Link
      id={id}
      href={href}
      className={cn(
        'group block bg-gradient-to-br border rounded-2xl p-5 transition-all duration-200 hover:scale-[1.01] hover:shadow-lg',
        colorMap[color]
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <svg
          className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1 group-hover:translate-x-0 duration-200"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M7 17L17 7M17 7H7M17 7v10" />
        </svg>
      </div>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      <p className="text-sm font-medium opacity-90">{label}</p>
      <p className="text-xs opacity-60 mt-0.5">{detail}</p>
    </Link>
  )
}
