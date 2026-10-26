// src/lib/odontograma.ts
// Lógica de dominio del odontograma (notación FDI / ISO 3950).
// Compartido entre cliente (componente gráfico) y servidor (validación).

export type RolPieza = 'tratar' | 'pilar' | 'pontico' | 'ausente'
export type Denticion = 'permanente' | 'temporal' | 'mixta'
export type VistaDenticion = 'permanente' | 'temporal'
export type TipoDiente = 'incisivo' | 'canino' | 'premolar' | 'molar'

export interface PiezaDental {
  fdi: number
  rol: RolPieza
}

// ─── Cuadrantes (orden desde la línea media hacia distal) ────────────────────
export const CUADRANTES: Record<VistaDenticion, { sup: [number[], number[]]; inf: [number[], number[]] }> = {
  permanente: {
    // [derecha del paciente, izquierda del paciente]
    sup: [[11, 12, 13, 14, 15, 16, 17, 18], [21, 22, 23, 24, 25, 26, 27, 28]],
    inf: [[41, 42, 43, 44, 45, 46, 47, 48], [31, 32, 33, 34, 35, 36, 37, 38]],
  },
  temporal: {
    sup: [[51, 52, 53, 54, 55], [61, 62, 63, 64, 65]],
    inf: [[81, 82, 83, 84, 85], [71, 72, 73, 74, 75]],
  },
}

export const PIEZAS_PERMANENTES = [
  ...CUADRANTES.permanente.sup[0], ...CUADRANTES.permanente.sup[1],
  ...CUADRANTES.permanente.inf[0], ...CUADRANTES.permanente.inf[1],
]
export const PIEZAS_TEMPORALES = [
  ...CUADRANTES.temporal.sup[0], ...CUADRANTES.temporal.sup[1],
  ...CUADRANTES.temporal.inf[0], ...CUADRANTES.temporal.inf[1],
]
const FDI_VALIDOS = new Set([...PIEZAS_PERMANENTES, ...PIEZAS_TEMPORALES])

/** Orden anatómico de una arcada, de derecha a izquierda del paciente (18→28). */
export function ordenArcada(vista: VistaDenticion, arcada: 'sup' | 'inf'): number[] {
  const [der, izq] = CUADRANTES[vista][arcada]
  return [...[...der].reverse(), ...izq]
}

// ─── Roles ───────────────────────────────────────────────────────────────────
export const ROLES_PIEZA: Record<
  RolPieza,
  { label: string; corto: string; descripcion: string; color: string; claro: string; oscuro: string; chip: string }
> = {
  tratar: {
    label: 'Pieza a tratar',
    corto: 'Tratar',
    descripcion: 'Corona, incrustación, carilla, restauración o pieza a reemplazar',
    color: '#38bdf8',
    claro: '#bae6fd',
    oscuro: '#0369a1',
    chip: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
  pilar: {
    label: 'Pilar',
    corto: 'Pilar',
    descripcion: 'Diente o implante de soporte del puente',
    color: '#a78bfa',
    claro: '#ddd6fe',
    oscuro: '#6d28d9',
    chip: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  },
  pontico: {
    label: 'Póntico',
    corto: 'Póntico',
    descripcion: 'Pieza artificial que reemplaza un diente ausente',
    color: '#fbbf24',
    claro: '#fde68a',
    oscuro: '#b45309',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  ausente: {
    label: 'Ausente',
    corto: 'Ausente',
    descripcion: 'Referencia: pieza que no está en boca (no se trabaja)',
    color: '#64748b',
    claro: '#94a3b8',
    oscuro: '#334155',
    chip: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  },
}
export const ROLES_ORDEN: RolPieza[] = ['tratar', 'pilar', 'pontico', 'ausente']

// ─── Identificación anatómica ────────────────────────────────────────────────
export function esTemporal(fdi: number) {
  return Math.floor(fdi / 10) >= 5
}

export function tipoDiente(fdi: number): TipoDiente {
  const n = fdi % 10
  if (n <= 2) return 'incisivo'
  if (n === 3) return 'canino'
  if (esTemporal(fdi)) return 'molar'
  return n <= 5 ? 'premolar' : 'molar'
}

export function esSuperior(fdi: number) {
  return [1, 2, 5, 6].includes(Math.floor(fdi / 10))
}

export function esDerecho(fdi: number) {
  return [1, 4, 5, 8].includes(Math.floor(fdi / 10))
}

const NOMBRES_PERM = ['', 'Incisivo central', 'Incisivo lateral', 'Canino', 'Primer premolar', 'Segundo premolar', 'Primer molar', 'Segundo molar', 'Tercer molar']
const NOMBRES_TEMP = ['', 'Incisivo central temporal', 'Incisivo lateral temporal', 'Canino temporal', 'Primer molar temporal', 'Segundo molar temporal']

export function nombreDiente(fdi: number, corto = false): string {
  const n = fdi % 10
  const base = esTemporal(fdi) ? NOMBRES_TEMP[n] : NOMBRES_PERM[n]
  if (corto) {
    return `${base} ${esSuperior(fdi) ? 'sup.' : 'inf.'} ${esDerecho(fdi) ? 'der.' : 'izq.'}`
  }
  return `${base} ${esSuperior(fdi) ? 'superior' : 'inferior'} ${esDerecho(fdi) ? 'derecho' : 'izquierdo'}`
}

// ─── Inteligencia ligada al tipo de trabajo ──────────────────────────────────
export interface SugerenciaTrabajo {
  rol: RolPieza
  sugerirArcada: boolean
  ayuda: string
}

export function sugerenciaPorTipoTrabajo(tipo: string | null | undefined): SugerenciaTrabajo {
  const t = (tipo ?? '').toLowerCase()
  if (/puente|bridge/.test(t)) {
    return {
      rol: 'pilar',
      sugerirArcada: false,
      ayuda: 'Puente: marque los dientes pilares (soporte) y luego los pónticos (piezas que se reemplazan).',
    }
  }
  if (/total|complet|dentadura|placa|f[eé]rula|guarda|bruxismo|blanqueamiento|ortod|retenedor/.test(t)) {
    return {
      rol: 'tratar',
      sugerirArcada: true,
      ayuda: 'Trabajo de arcada: use los botones "Arcada superior / inferior" para seleccionarla completa.',
    }
  }
  if (/removible|parcial|esquel|flexible|acr[ií]lic/.test(t)) {
    return {
      rol: 'pontico',
      sugerirArcada: false,
      ayuda: 'Prótesis parcial: marque como Póntico las piezas a reemplazar y como Pilar los dientes retenedores (ganchos).',
    }
  }
  if (/implante/.test(t)) {
    return {
      rol: 'tratar',
      sugerirArcada: false,
      ayuda: 'Implante: marque la(s) posición(es) del implante. Si es puente sobre implantes, use Pilar y Póntico.',
    }
  }
  return {
    rol: 'tratar',
    sugerirArcada: false,
    ayuda: 'Seleccione en el odontograma las piezas que el laboratorio debe trabajar.',
  }
}

/** Dentición sugerida a partir de la fecha de nacimiento del paciente. */
export function denticionPorEdad(fechaNacimiento: string | null | undefined): VistaDenticion | null {
  if (!fechaNacimiento) return null
  const nac = new Date(fechaNacimiento)
  if (Number.isNaN(nac.getTime())) return null
  const hoy = new Date()
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad < 12 ? 'temporal' : 'permanente'
}

export function calcularDenticion(piezas: PiezaDental[]): Denticion | null {
  if (piezas.length === 0) return null
  const temp = piezas.some((p) => esTemporal(p.fdi))
  const perm = piezas.some((p) => !esTemporal(p.fdi))
  if (temp && perm) return 'mixta'
  return temp ? 'temporal' : 'permanente'
}

/** Normaliza y valida (servidor y cliente): FDI válidos, roles válidos, sin duplicados. */
export function sanitizarPiezas(input: unknown): PiezaDental[] {
  if (!Array.isArray(input)) return []
  const mapa = new Map<number, RolPieza>()
  for (const raw of input) {
    const fdi = Number((raw as any)?.fdi)
    const rol = (raw as any)?.rol as RolPieza
    if (FDI_VALIDOS.has(fdi) && rol in ROLES_PIEZA) mapa.set(fdi, rol)
  }
  return Array.from(mapa, ([fdi, rol]) => ({ fdi, rol })).sort(
    (a, b) => ordenClinico(a.fdi) - ordenClinico(b.fdi)
  )
}

/** Orden clínico de lectura: 18→11, 21→28, 38→31, 41→48 (temporales al final). */
function ordenClinico(fdi: number) {
  const q = Math.floor(fdi / 10)
  const n = fdi % 10
  const base = esTemporal(fdi) ? 100 : 0
  const qq = esTemporal(fdi) ? q - 4 : q
  if (qq === 1) return base + (9 - n)
  if (qq === 2) return base + 10 + n
  if (qq === 3) return base + 30 + (9 - n)
  return base + 40 + n
}

export function agruparPorRol(piezas: PiezaDental[]): Record<RolPieza, number[]> {
  const out: Record<RolPieza, number[]> = { tratar: [], pilar: [], pontico: [], ausente: [] }
  for (const p of sanitizarPiezas(piezas)) out[p.rol].push(p.fdi)
  return out
}

/** Texto plano legible (para emails, PDFs, observaciones). */
export function resumenPiezasTexto(piezas: PiezaDental[]): string {
  const g = agruparPorRol(piezas)
  return ROLES_ORDEN.filter((r) => g[r].length > 0)
    .map((r) => `${ROLES_PIEZA[r].label}: ${g[r].join(', ')}`)
    .join(' · ')
}
