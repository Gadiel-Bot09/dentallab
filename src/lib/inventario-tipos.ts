// src/lib/inventario-tipos.ts
// Clasificación unificada del catálogo `inventario`:
//   - insumo      -> INS-XXXX (Insumos clínicos / farmacia)
//   - medicamento -> MED-XXXX (Medicamentos)
//   - material    -> MAT-XXXX (Materiales de laboratorio dental)

export type TipoItemInventario = 'insumo' | 'medicamento' | 'material'

export interface TipoItemMeta {
  tipo: TipoItemInventario
  prefijo: 'INS' | 'MED' | 'MAT'
  label: string
  corto: string
  icono: string
  descripcion: string
  ejemplo: string
  badgeClass: string
  activeCardClass: string
}

export const TIPOS_ITEM_INVENTARIO: Record<TipoItemInventario, TipoItemMeta> = {
  insumo: {
    tipo: 'insumo',
    prefijo: 'INS',
    label: 'Insumo Clínico / Farmacia',
    corto: 'Insumo',
    icono: '🧴',
    descripcion: 'Desechables, guantes, gasas, jeringas, dispositivos médicos',
    ejemplo: 'INS-0001',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    activeCardClass: 'bg-emerald-500/15 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/40',
  },
  medicamento: {
    tipo: 'medicamento',
    prefijo: 'MED',
    label: 'Medicamento',
    corto: 'Medicamento',
    icono: '💊',
    descripcion: 'Anestésicos, antibióticos, analgésicos, antisépticos',
    ejemplo: 'MED-0001',
    badgeClass: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    activeCardClass: 'bg-violet-500/15 border-violet-500 text-violet-300 ring-1 ring-violet-500/40',
  },
  material: {
    tipo: 'material',
    prefijo: 'MAT',
    label: 'Material de Laboratorio',
    corto: 'Material Lab',
    icono: '🛠️',
    descripcion: 'Resinas, acrílicos, yesos, ceras, metales para prótesis',
    ejemplo: 'MAT-0001',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    activeCardClass: 'bg-sky-500/15 border-sky-500 text-sky-300 ring-1 ring-sky-500/40',
  },
}

export const TIPOS_ITEM_ORDEN: TipoItemInventario[] = ['insumo', 'medicamento', 'material']

/** Resuelve el tipo real de un ítem usando `tipo_item` o infiriéndolo por su prefijo de código */
export function resolverTipoItem(
  codigo?: string | null,
  tipoItem?: string | null
): TipoItemInventario {
  if (tipoItem === 'insumo' || tipoItem === 'medicamento' || tipoItem === 'material') {
    return tipoItem
  }
  const c = (codigo || '').toUpperCase()
  if (c.startsWith('INS-') || c.startsWith('INSU-')) return 'insumo'
  if (c.startsWith('MED-')) return 'medicamento'
  return 'material'
}

export function getBadgeClassPorCodigo(codigo?: string | null, tipoItem?: string | null): string {
  return TIPOS_ITEM_INVENTARIO[resolverTipoItem(codigo, tipoItem)].badgeClass
}
