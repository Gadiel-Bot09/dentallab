'use client'
// src/components/odontograma/Odontograma.tsx
// Odontograma anatómico interactivo en SVG (vista oclusal, notación FDI).
// - Arcadas en herradura con piezas de tamaño y forma anatómica real.
// - Dentición permanente (adulto) y temporal (niño); admite dentición mixta.
// - Roles por pieza: tratar / pilar / póntico / ausente.
// - Selección por clic, arrastre (pintar), teclado (Tab + Enter/Espacio).
// - Modo solo-lectura para el detalle de la orden y el portal del laboratorio.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CUADRANTES,
  ROLES_ORDEN,
  ROLES_PIEZA,
  agruparPorRol,
  esTemporal,
  nombreDiente,
  ordenArcada,
  sanitizarPiezas,
  sugerenciaPorTipoTrabajo,
  tipoDiente,
  type PiezaDental,
  type RolPieza,
  type TipoDiente,
  type VistaDenticion,
} from '@/lib/odontograma'

// ─── Geometría ───────────────────────────────────────────────────────────────
// Dimensiones anatómicas promedio [mesiodistal, vestíbulo-lingual] en mm,
// indexadas por la posición del diente (1 = incisivo central).
const DIMS: Record<VistaDenticion, { sup: [number, number][]; inf: [number, number][] }> = {
  permanente: {
    sup: [[8.6, 7.1], [6.6, 6.2], [7.6, 8.0], [7.0, 9.0], [6.7, 9.0], [10.2, 11.2], [9.2, 11.0], [8.6, 10.5]],
    inf: [[5.4, 5.9], [5.9, 6.3], [6.9, 7.6], [7.0, 7.8], [7.2, 8.2], [11.0, 10.4], [10.4, 10.0], [10.0, 9.6]],
  },
  temporal: {
    sup: [[6.5, 5.1], [5.2, 4.6], [6.9, 6.1], [7.2, 8.6], [8.8, 10.0]],
    inf: [[4.2, 4.0], [4.6, 4.3], [5.8, 5.4], [7.8, 7.2], [9.8, 8.9]],
  },
}

interface ArchConfig {
  scale: number // px por mm
  a: number // semieje horizontal de la elipse
  b: number // semieje vertical
  topY: number // y del borde incisal superior (centro incisivos superiores)
  bottomY: number // y del centro de incisivos inferiores
  gap: number // espacio interproximal en px
}

const VIEW_W = 360
const VIEW_H = 500
const CX = VIEW_W / 2

const CONFIG: Record<VistaDenticion, ArchConfig> = {
  permanente: { scale: 3.3, a: 112, b: 175, topY: 44, bottomY: 456, gap: 1.6 },
  temporal: { scale: 4.3, a: 96, b: 112, topY: 70, bottomY: 430, gap: 2 },
}

interface ToothGeom {
  fdi: number
  x: number
  y: number
  rot: number
  w: number
  d: number
  tipo: TipoDiente
  lx: number
  ly: number
}

/** Tabla de longitud de arco para una elipse (parámetro t desde el ápice). */
function buildArcTable(a: number, b: number, steps = 600, tMax = Math.PI * 0.8) {
  const ts: number[] = [0]
  const ss: number[] = [0]
  let prevX = 0
  let prevY = 0
  for (let i = 1; i <= steps; i++) {
    const t = (tMax * i) / steps
    const x = a * Math.sin(t)
    const y = b * (1 - Math.cos(t))
    ss.push(ss[i - 1] + Math.hypot(x - prevX, y - prevY))
    ts.push(t)
    prevX = x
    prevY = y
  }
  return (s: number) => {
    // búsqueda binaria + interpolación lineal
    let lo = 0
    let hi = ss.length - 1
    if (s >= ss[hi]) return ts[hi]
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (ss[mid] < s) lo = mid
      else hi = mid
    }
    const f = (s - ss[lo]) / (ss[hi] - ss[lo] || 1)
    return ts[lo] + f * (ts[hi] - ts[lo])
  }
}

function layoutDenticion(vista: VistaDenticion): ToothGeom[] {
  const cfg = CONFIG[vista]
  const tAt = buildArcTable(cfg.a, cfg.b)
  const out: ToothGeom[] = []

  for (const arcada of ['sup', 'inf'] as const) {
    const dims = DIMS[vista][arcada]
    const [derecha, izquierda] = CUADRANTES[vista][arcada]
    for (const [lado, nums] of [[-1, derecha], [1, izquierda]] as const) {
      let s = cfg.gap / 2
      nums.forEach((fdi, i) => {
        const [wmm, dmm] = dims[i]
        const w = wmm * cfg.scale
        const d = dmm * cfg.scale
        const sc = s + w / 2
        s += w + cfg.gap
        const t = tAt(sc)
        const sinT = Math.sin(t)
        const cosT = Math.cos(t)
        const x = CX + lado * cfg.a * sinT
        const y = arcada === 'sup' ? cfg.topY + cfg.b * (1 - cosT) : cfg.bottomY - cfg.b * (1 - cosT)
        // normal exterior (hacia vestibular)
        let nx = (lado * sinT) / cfg.a
        let ny = (arcada === 'sup' ? -cosT : cosT) / cfg.b
        const len = Math.hypot(nx, ny) || 1
        nx /= len
        ny /= len
        const rot = (Math.atan2(-nx, ny) * 180) / Math.PI
        const off = d / 2 + 10
        out.push({ fdi, x, y, rot, w, d, tipo: tipoDiente(fdi), lx: x + nx * off, ly: y + ny * off })
      })
    }
  }
  return out
}

// Formas oclusales en coordenadas locales: x = mesiodistal, +y = vestibular.
function toothOutline(tipo: TipoDiente, w: number, d: number): string {
  const hw = w / 2
  const hd = d / 2
  switch (tipo) {
    case 'incisivo':
      return [
        `M ${-hw} ${hd * 0.25}`,
        `Q ${-hw} ${hd} ${-hw * 0.45} ${hd}`,
        `L ${hw * 0.45} ${hd}`,
        `Q ${hw} ${hd} ${hw} ${hd * 0.25}`,
        `Q ${hw * 0.9} ${-hd * 0.6} 0 ${-hd}`,
        `Q ${-hw * 0.9} ${-hd * 0.6} ${-hw} ${hd * 0.25} Z`,
      ].join(' ')
    case 'canino':
      return [
        `M 0 ${hd}`,
        `Q ${hw} ${hd * 0.85} ${hw} ${hd * 0.05}`,
        `Q ${hw * 0.85} ${-hd * 0.9} 0 ${-hd}`,
        `Q ${-hw * 0.85} ${-hd * 0.9} ${-hw} ${hd * 0.05}`,
        `Q ${-hw} ${hd * 0.85} 0 ${hd} Z`,
      ].join(' ')
    case 'premolar': {
      const r = Math.min(hw, hd) * 0.85
      return roundedRect(w, d, r)
    }
    case 'molar':
    default: {
      const r = Math.min(hw, hd) * 0.55
      return roundedRect(w, d, r)
    }
  }
}

function roundedRect(w: number, d: number, r: number) {
  const hw = w / 2
  const hd = d / 2
  return [
    `M ${-hw + r} ${-hd}`,
    `L ${hw - r} ${-hd}`,
    `Q ${hw} ${-hd} ${hw} ${-hd + r}`,
    `L ${hw} ${hd - r}`,
    `Q ${hw} ${hd} ${hw - r} ${hd}`,
    `L ${-hw + r} ${hd}`,
    `Q ${-hw} ${hd} ${-hw} ${hd - r}`,
    `L ${-hw} ${-hd + r}`,
    `Q ${-hw} ${-hd} ${-hw + r} ${-hd} Z`,
  ].join(' ')
}

// Surcos / detalles anatómicos de la cara oclusal
function toothDetail(tipo: TipoDiente, w: number, d: number): string {
  const hw = w / 2
  const hd = d / 2
  switch (tipo) {
    case 'incisivo':
      return `M ${-hw * 0.62} ${hd * 0.45} Q 0 ${hd * 0.7} ${hw * 0.62} ${hd * 0.45}`
    case 'canino':
      return `M ${-hw * 0.55} ${hd * 0.05} L 0 ${hd * 0.4} L ${hw * 0.55} ${hd * 0.05} M 0 ${hd * 0.4} L 0 ${-hd * 0.45}`
    case 'premolar':
      return `M ${-hw * 0.5} ${-hd * 0.02} Q 0 ${hd * 0.14} ${hw * 0.5} ${-hd * 0.02}`
    case 'molar':
    default:
      return [
        `M ${-hw * 0.6} ${-hd * 0.05} L ${-hw * 0.12} ${hd * 0.04} L ${hw * 0.22} ${-hd * 0.06} L ${hw * 0.6} ${hd * 0.02}`,
        `M ${-hw * 0.12} ${hd * 0.04} L ${-hw * 0.08} ${hd * 0.62}`,
        `M ${hw * 0.22} ${-hd * 0.06} L ${hw * 0.18} ${-hd * 0.62}`,
      ].join(' ')
  }
}

// ─── Componente ──────────────────────────────────────────────────────────────
interface OdontogramaProps {
  value: PiezaDental[]
  onChange?: (piezas: PiezaDental[]) => void
  readOnly?: boolean
  tipoTrabajo?: string
  /** Dentición a mostrar por defecto (p. ej. según la edad del paciente). */
  vistaSugerida?: VistaDenticion | null
  className?: string
}

export default function Odontograma({
  value,
  onChange,
  readOnly = false,
  tipoTrabajo,
  vistaSugerida,
  className = '',
}: OdontogramaProps) {
  const piezas = useMemo(() => sanitizarPiezas(value), [value])
  const mapa = useMemo(() => new Map(piezas.map((p) => [p.fdi, p.rol])), [piezas])

  const sugerencia = useMemo(() => sugerenciaPorTipoTrabajo(tipoTrabajo), [tipoTrabajo])
  const [herramienta, setHerramienta] = useState<RolPieza>(sugerencia.rol)
  const [vista, setVista] = useState<VistaDenticion>(() => {
    if (vistaSugerida) return vistaSugerida
    if (piezas.length > 0 && piezas.every((p) => esTemporal(p.fdi))) return 'temporal'
    return 'permanente'
  })
  const [hover, setHover] = useState<number | null>(null)

  // La herramienta activa se adapta al tipo de trabajo elegido
  useEffect(() => {
    setHerramienta(sugerencia.rol)
  }, [sugerencia.rol])

  useEffect(() => {
    if (vistaSugerida) setVista(vistaSugerida)
  }, [vistaSugerida])

  // Referencias para pintar arrastrando sin cierres obsoletos
  const piezasRef = useRef(piezas)
  piezasRef.current = piezas
  const pintando = useRef<null | { op: 'set' | 'remove'; rol: RolPieza }>(null)

  useEffect(() => {
    const stop = () => {
      pintando.current = null
    }
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [])

  function emitir(next: Map<number, RolPieza>) {
    onChange?.(sanitizarPiezas(Array.from(next, ([fdi, rol]) => ({ fdi, rol }))))
  }

  function aplicar(fdi: number, op: 'set' | 'remove', rol: RolPieza) {
    const next = new Map(piezasRef.current.map((p) => [p.fdi, p.rol]))
    if (op === 'remove') next.delete(fdi)
    else next.set(fdi, rol)
    piezasRef.current = Array.from(next, ([f, r]) => ({ fdi: f, rol: r }))
    emitir(next)
  }

  function toggle(fdi: number) {
    const actual = piezasRef.current.find((p) => p.fdi === fdi)?.rol
    const op = actual === herramienta ? 'remove' : 'set'
    aplicar(fdi, op, herramienta)
    return op
  }

  function seleccionarArcada(arcada: 'sup' | 'inf') {
    const nums = ordenArcada(vista, arcada)
    const next = new Map(piezasRef.current.map((p) => [p.fdi, p.rol]))
    const todas = nums.every((n) => next.get(n) === herramienta)
    nums.forEach((n) => (todas ? next.delete(n) : next.set(n, herramienta)))
    emitir(next)
  }

  function limpiar() {
    emitir(new Map())
  }

  const geom = useMemo(() => layoutDenticion(vista), [vista])
  const geomMap = useMemo(() => new Map(geom.map((g) => [g.fdi, g])), [geom])

  // Conectores de puente: piezas contiguas con rol pilar/póntico en la misma arcada
  const conectores = useMemo(() => {
    const segs: { x1: number; y1: number; x2: number; y2: number }[] = []
    for (const arcada of ['sup', 'inf'] as const) {
      const orden = ordenArcada(vista, arcada)
      for (let i = 0; i < orden.length - 1; i++) {
        const a = mapa.get(orden[i])
        const b = mapa.get(orden[i + 1])
        const esPuente = (r?: RolPieza) => r === 'pilar' || r === 'pontico'
        if (esPuente(a) && esPuente(b)) {
          const g1 = geomMap.get(orden[i])!
          const g2 = geomMap.get(orden[i + 1])!
          segs.push({ x1: g1.x, y1: g1.y, x2: g2.x, y2: g2.y })
        }
      }
    }
    return segs
  }, [mapa, geomMap, vista])

  const grupos = useMemo(() => agruparPorRol(piezas), [piezas])
  const ocultasEnOtraVista = piezas.filter((p) => esTemporal(p.fdi) !== (vista === 'temporal')).length
  const cfg = CONFIG[vista]
  const midY = (cfg.topY + cfg.bottomY) / 2

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Barra superior: dentición + herramientas */}
      {(!readOnly || piezas.length > 0) && (
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <div className="inline-flex self-start p-1 bg-slate-800/80 border border-slate-700 rounded-xl">
            {(['permanente', 'temporal'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVista(v)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  vista === v ? 'bg-sky-500 text-white shadow shadow-sky-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                {v === 'permanente' ? '🧑 Adulto (permanente)' : '🧒 Niño (temporal)'}
              </button>
            ))}
          </div>

          {!readOnly && (
          <div className="flex flex-wrap gap-1.5">
            {ROLES_ORDEN.map((r) => {
              const info = ROLES_PIEZA[r]
              const activo = herramienta === r
              return (
                <button
                  key={r}
                  type="button"
                  title={info.descripcion}
                  onClick={() => setHerramienta(r)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    activo ? 'text-white shadow-lg' : 'text-slate-400 border-slate-700 hover:text-white hover:border-slate-500'
                  }`}
                  style={
                    activo
                      ? { background: `${info.color}33`, borderColor: info.color, boxShadow: `0 0 0 1px ${info.color}55` }
                      : undefined
                  }
                >
                  <span
                    className="w-3 h-3 rounded-full border"
                    style={{
                      background: r === 'ausente' ? 'transparent' : info.color,
                      borderColor: info.color,
                      borderStyle: r === 'ausente' ? 'dashed' : 'solid',
                    }}
                  />
                  {info.corto}
                </button>
              )
            })}
          </div>
          )}
        </div>
      )}

      {!readOnly && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-sky-500/5 border border-sky-500/20 text-xs text-sky-200/90">
          <span>💡</span>
          <span>
            {sugerencia.ayuda}{' '}
            <span className="text-slate-400">Clic para marcar/desmarcar · arrastre para marcar varias piezas.</span>
          </span>
        </div>
      )}

      <div className={`grid gap-4 ${readOnly ? 'grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'grid-cols-1 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]'}`}>
        {/* Gráfico */}
        <div className="relative rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-800 p-2">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="w-full h-auto max-h-[520px] select-none touch-none"
            role="group"
            aria-label={`Odontograma ${vista}`}
          >
            <defs>
              <radialGradient id="esmalte" cx="40%" cy="35%" r="75%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="60%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#94a3b8" />
              </radialGradient>
              {ROLES_ORDEN.filter((r) => r !== 'ausente').map((r) => (
                <radialGradient key={r} id={`grad-${r}`} cx="40%" cy="35%" r="80%">
                  <stop offset="0%" stopColor={ROLES_PIEZA[r].claro} />
                  <stop offset="70%" stopColor={ROLES_PIEZA[r].color} />
                  <stop offset="100%" stopColor={ROLES_PIEZA[r].oscuro} />
                </radialGradient>
              ))}
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="sombra" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" floodColor="#000" floodOpacity="0.55" />
              </filter>
            </defs>

            {/* Encía de fondo */}
            {(['sup', 'inf'] as const).map((arc) => {
              const orden = ordenArcada(vista, arc).map((f) => geomMap.get(f)!)
              const dPath = orden.map((g, i) => `${i === 0 ? 'M' : 'L'} ${g.x.toFixed(1)} ${g.y.toFixed(1)}`).join(' ')
              return (
                <path
                  key={arc}
                  d={dPath}
                  fill="none"
                  stroke="#be185d"
                  strokeOpacity={0.16}
                  strokeWidth={vista === 'permanente' ? 44 : 42}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )
            })}

            {/* Línea media y referencias */}
            <line x1={CX} y1={8} x2={CX} y2={VIEW_H - 8} stroke="#334155" strokeDasharray="3 5" strokeWidth={1} />
            <text x={CX} y={cfg.topY + 70} textAnchor="middle" className="fill-slate-500" fontSize={10} fontWeight={700} letterSpacing={2}>
              SUPERIOR
            </text>
            <text x={CX} y={cfg.bottomY - 64} textAnchor="middle" className="fill-slate-500" fontSize={10} fontWeight={700} letterSpacing={2}>
              INFERIOR
            </text>
            <text x={18} y={midY + 4} className="fill-slate-600" fontSize={9} fontWeight={600}>
              DERECHA
            </text>
            <text x={VIEW_W - 18} y={midY + 4} textAnchor="end" className="fill-slate-600" fontSize={9} fontWeight={600}>
              IZQUIERDA
            </text>

            {/* Información de la pieza bajo el cursor */}
            <g>
              <text x={CX} y={midY - 4} textAnchor="middle" className="fill-white" fontSize={hover ? 22 : 11} fontWeight={800}>
                {hover ?? (piezas.length > 0 ? `${piezas.length} pieza(s)` : '')}
              </text>
              <text x={CX} y={midY + 13} textAnchor="middle" className="fill-slate-400" fontSize={9}>
                {hover ? nombreDiente(hover, true) : piezas.length > 0 ? 'seleccionada(s)' : readOnly ? 'Sin piezas registradas' : 'Seleccione las piezas'}
              </text>
              {hover && mapa.get(hover) && (
                <text x={CX} y={midY + 27} textAnchor="middle" fontSize={9} fontWeight={700} fill={ROLES_PIEZA[mapa.get(hover)!].color}>
                  {ROLES_PIEZA[mapa.get(hover)!].label.toUpperCase()}
                </text>
              )}
            </g>

            {/* Conectores de puente */}
            {conectores.map((c, i) => (
              <line
                key={i}
                x1={c.x1}
                y1={c.y1}
                x2={c.x2}
                y2={c.y2}
                stroke="#a78bfa"
                strokeWidth={6}
                strokeLinecap="round"
                strokeOpacity={0.75}
                filter="url(#glow)"
              />
            ))}

            {/* Piezas */}
            {geom.map((g) => {
              const rol = mapa.get(g.fdi)
              const isHover = hover === g.fdi
              const color = rol ? ROLES_PIEZA[rol].color : '#94a3b8'
              const fill = !rol ? 'url(#esmalte)' : rol === 'ausente' ? 'rgba(15,23,42,0.6)' : `url(#grad-${rol})`
              const outline = toothOutline(g.tipo, g.w, g.d)
              return (
                <g
                  key={g.fdi}
                  role={readOnly ? undefined : 'button'}
                  tabIndex={readOnly ? undefined : 0}
                  aria-label={`${g.fdi} ${nombreDiente(g.fdi)}${rol ? ` — ${ROLES_PIEZA[rol].label}` : ''}`}
                  aria-pressed={readOnly ? undefined : !!rol}
                  className={readOnly ? '' : 'cursor-pointer outline-none'}
                  onPointerEnter={() => {
                    setHover(g.fdi)
                    if (!readOnly && pintando.current) aplicar(g.fdi, pintando.current.op, pintando.current.rol)
                  }}
                  onPointerLeave={() => setHover((h) => (h === g.fdi ? null : h))}
                  onPointerDown={(e) => {
                    if (readOnly) return
                    e.preventDefault()
                    // liberar captura implícita (táctil) para poder pintar arrastrando
                    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
                    const op = toggle(g.fdi)
                    pintando.current = { op, rol: herramienta }
                  }}
                  onKeyDown={(e) => {
                    if (readOnly) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggle(g.fdi)
                    }
                  }}
                  onFocus={() => setHover(g.fdi)}
                  onBlur={() => setHover((h) => (h === g.fdi ? null : h))}
                >
                  <g transform={`translate(${g.x.toFixed(2)} ${g.y.toFixed(2)}) rotate(${g.rot.toFixed(2)})`}>
                    {/* halo de hover/selección */}
                    {(isHover || (rol && rol !== 'ausente')) && (
                      <path
                        d={outline}
                        fill="none"
                        stroke={isHover && !rol ? '#38bdf8' : color}
                        strokeWidth={isHover ? 5 : 3.5}
                        strokeOpacity={isHover ? 0.55 : 0.35}
                        strokeLinejoin="round"
                      />
                    )}
                    <path
                      d={outline}
                      fill={fill}
                      stroke={rol ? (rol === 'ausente' ? '#64748b' : ROLES_PIEZA[rol].oscuro) : '#64748b'}
                      strokeWidth={1.1}
                      strokeDasharray={rol === 'ausente' ? '3 2' : undefined}
                      strokeLinejoin="round"
                      filter={rol === 'ausente' ? undefined : 'url(#sombra)'}
                      style={{ transition: 'fill 150ms ease' }}
                    />
                    {rol !== 'ausente' && (
                      <path
                        d={toothDetail(g.tipo, g.w, g.d)}
                        fill="none"
                        stroke={rol ? ROLES_PIEZA[rol].oscuro : '#94a3b8'}
                        strokeOpacity={0.7}
                        strokeWidth={0.9}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {rol === 'pontico' && (
                      <circle r={Math.min(g.w, g.d) * 0.16} fill="none" stroke="#78350f" strokeWidth={1.2} strokeOpacity={0.8} />
                    )}
                    {rol === 'ausente' && (
                      <path
                        d={`M ${-g.w * 0.28} ${-g.d * 0.28} L ${g.w * 0.28} ${g.d * 0.28} M ${g.w * 0.28} ${-g.d * 0.28} L ${-g.w * 0.28} ${g.d * 0.28}`}
                        stroke="#f87171"
                        strokeWidth={1.6}
                        strokeLinecap="round"
                      />
                    )}
                  </g>
                  {/* número FDI */}
                  <text
                    x={g.lx}
                    y={g.ly + 3.3}
                    textAnchor="middle"
                    fontSize={vista === 'permanente' ? 9.5 : 10.5}
                    fontWeight={rol || isHover ? 800 : 500}
                    fill={rol ? color : isHover ? '#e2e8f0' : '#64748b'}
                    style={{ pointerEvents: 'none' }}
                  >
                    {g.fdi}
                  </text>
                </g>
              )
            })}
          </svg>

          {ocultasEnOtraVista > 0 && (
            <div className="absolute top-3 left-3 right-3 text-center">
              <span className="inline-block px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-medium">
                Dentición mixta: {ocultasEnOtraVista} pieza(s) marcadas en la vista {vista === 'permanente' ? 'temporal' : 'permanente'}
              </span>
            </div>
          )}
        </div>

        {/* Panel lateral: acciones rápidas + resumen */}
        <div className="space-y-3">
          {!readOnly && (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => seleccionarArcada('sup')}
                className={`px-2 py-2 rounded-xl text-[11px] font-semibold border transition-all ${
                  sugerencia.sugerirArcada
                    ? 'bg-sky-500/15 border-sky-500/40 text-sky-300 hover:bg-sky-500/25'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                ⬆ Arcada superior
              </button>
              <button
                type="button"
                onClick={() => seleccionarArcada('inf')}
                className={`px-2 py-2 rounded-xl text-[11px] font-semibold border transition-all ${
                  sugerencia.sugerirArcada
                    ? 'bg-sky-500/15 border-sky-500/40 text-sky-300 hover:bg-sky-500/25'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                ⬇ Arcada inferior
              </button>
              <button
                type="button"
                onClick={limpiar}
                disabled={piezas.length === 0}
                className="px-2 py-2 rounded-xl text-[11px] font-semibold border bg-slate-800 border-slate-700 text-slate-300 hover:border-red-500/50 hover:text-red-300 disabled:opacity-40 transition-all"
              >
                ✕ Limpiar
              </button>
            </div>
          )}

          <div className="rounded-2xl bg-slate-950/60 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Piezas del trabajo</p>
              <span className="text-[11px] text-slate-500">Notación FDI</span>
            </div>

            {piezas.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                {readOnly ? 'Esta orden no tiene piezas registradas.' : 'Aún no hay piezas seleccionadas.'}
              </p>
            ) : (
              ROLES_ORDEN.filter((r) => grupos[r].length > 0).map((r) => (
                <div key={r} className="space-y-1.5">
                  <p className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: ROLES_PIEZA[r].color }}>
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: r === 'ausente' ? 'transparent' : ROLES_PIEZA[r].color, border: `1px solid ${ROLES_PIEZA[r].color}` }}
                    />
                    {ROLES_PIEZA[r].label} ({grupos[r].length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {grupos[r].map((fdi) => (
                      <span
                        key={fdi}
                        title={nombreDiente(fdi)}
                        onMouseEnter={() => setHover(fdi)}
                        onMouseLeave={() => setHover(null)}
                        className={`inline-flex items-center gap-1 pl-2 ${readOnly ? 'pr-2' : 'pr-1'} py-0.5 rounded-md border text-[11px] font-mono font-bold ${ROLES_PIEZA[r].chip}`}
                      >
                        {fdi}
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => aplicar(fdi, 'remove', r)}
                            className="px-1 text-slate-400 hover:text-red-300"
                            aria-label={`Quitar pieza ${fdi}`}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Leyenda */}
          <div className="rounded-2xl bg-slate-950/40 border border-slate-800/70 p-3 grid grid-cols-2 gap-2">
            {ROLES_ORDEN.map((r) => (
              <div key={r} className="flex items-start gap-2">
                <span
                  className="mt-0.5 w-3 h-3 rounded shrink-0"
                  style={{
                    background: r === 'ausente' ? 'transparent' : ROLES_PIEZA[r].color,
                    border: `1px ${r === 'ausente' ? 'dashed' : 'solid'} ${ROLES_PIEZA[r].color}`,
                  }}
                />
                <div>
                  <p className="text-[11px] font-semibold text-slate-300">{ROLES_PIEZA[r].label}</p>
                  <p className="text-[10px] text-slate-500 leading-tight">{ROLES_PIEZA[r].descripcion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
