'use client'
// src/app/(interno)/farmacia/stock/_components/ModalRecepcionNormativa.tsx
import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import type { Farmacia } from '@/types/database'
import {
  CONDICION_ALMACENAMIENTO_LABELS,
  DICTAMEN_TECNICO_LABELS,
  TIPO_DOC_RECEPCION_LABELS,
  evaluarVencimiento,
  type CondicionAlmacenamiento,
  type DictamenTecnico,
  type Proveedor,
  type TipoDocumentoRecepcion,
} from '@/types/farmacia'
import InsumoSearchSelect, { type MaterialSearchOption } from '@/app/(interno)/_components/InsumoSearchSelect'
import CrearInsumoRapidoModal, { type CrearInsumoInitialData } from '@/components/modals/CrearInsumoRapidoModal'
import {
  crearProveedorAction,
  obtenerDetalleRecepcionAction,
  registrarRecepcionNormativaAction,
  type RecepcionNormativaItemInput,
} from '../actions'
import { generarActaRecepcionPDF } from '@/lib/farmacia-pdf'

interface EntradaRow {
  material_id: string
  codigo_barras: string
  registro_sanitario: string
  laboratorio_fabricante: string
  presentacion: string
  numero_lote: string
  fecha_vencimiento: string
  fecha_fabricacion: string
  cantidad: number
  costo_unitario: number
  descuento_porcentaje: number
  iva_porcentaje: number
  precio_venta_sugerido: string
  condiciones_almacenamiento: CondicionAlmacenamiento
  cumple_especificaciones: boolean
  requiere_lote: boolean
  requiere_vencimiento: boolean
  observaciones: string
}

function createEmptyRow(): EntradaRow {
  return {
    material_id: '',
    codigo_barras: '',
    registro_sanitario: '',
    laboratorio_fabricante: '',
    presentacion: '',
    numero_lote: '',
    fecha_vencimiento: '',
    fecha_fabricacion: '',
    cantidad: 1,
    costo_unitario: 0,
    descuento_porcentaje: 0,
    iva_porcentaje: 0,
    precio_venta_sugerido: '',
    condiciones_almacenamiento: 'ambiente',
    cumple_especificaciones: true,
    requiere_lote: true,
    requiere_vencimiento: true,
    observaciones: '',
  }
}

function fmtCOP(v: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(v || 0)
}

function calcLinea(row: EntradaRow) {
  const cant = Math.max(0, Number(row.cantidad) || 0)
  const unit = Math.max(0, Number(row.costo_unitario) || 0)
  const descPct = Math.max(0, Math.min(100, Number(row.descuento_porcentaje) || 0))
  const ivaPct = Math.max(0, Math.min(100, Number(row.iva_porcentaje) || 0))

  const subtotal = cant * unit
  const descuento = subtotal * (descPct / 100)
  const baseIva = Math.max(0, subtotal - descuento)
  const iva = baseIva * (ivaPct / 100)
  const total = baseIva + iva
  return { subtotal, descuento, iva, total }
}

interface Props {
  farmacia: Farmacia | undefined
  allMaterials: MaterialSearchOption[]
  initialProveedores: Proveedor[]
  categorias: { id: string; nombre: string }[]
  unidades: { id: string; nombre: string; abreviatura?: string | null }[]
  onClose: () => void
  onSuccessReload: () => void
}

export default function ModalRecepcionNormativa({
  farmacia,
  allMaterials,
  initialProveedores,
  categorias,
  unidades,
  onClose,
  onSuccessReload,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Catálogo local de insumos (se actualiza en vivo al crear insumos nuevos)
  const [materials, setMaterials] = useState<MaterialSearchOption[]>(allMaterials)

  // Modal de creación rápida de insumo nuevo
  const [nuevoInsumoModal, setNuevoInsumoModal] = useState<{
    open: boolean
    targetRowIdx: number
    initialData?: CrearInsumoInitialData
  }>({ open: false, targetRowIdx: 0 })

  // Proveedores
  const [proveedores, setProveedores] = useState<Proveedor[]>(initialProveedores)
  const [proveedorId, setProveedorId] = useState<string>('')
  const [proveedorManual, setProveedorManual] = useState('')
  const [proveedorNitManual, setProveedorNitManual] = useState('')
  const [showNuevoProv, setShowNuevoProv] = useState(false)
  const [nuevoProv, setNuevoProv] = useState({
    nit: '',
    razon_social: '',
    telefono: '',
    email: '',
    contacto_nombre: '',
    ciudad: '',
  })
  const [savingProv, setSavingProv] = useState(false)

  // Documento y Recepción Técnica
  const todayISO = new Date().toISOString().split('T')[0]
  const [tipoDoc, setTipoDoc] = useState<TipoDocumentoRecepcion>('factura')
  const [numeroDoc, setNumeroDoc] = useState('')
  const [fechaDoc, setFechaDoc] = useState(todayISO)
  const [temperatura, setTemperatura] = useState('')
  const [humedad, setHumedad] = useState('')
  const [empaqueOk, setEmpaqueOk] = useState(true)
  const [cadenaFrioOk, setCadenaFrioOk] = useState(true)
  const [dictamen, setDictamen] = useState<DictamenTecnico>('aprobado')
  const [observaciones, setObservaciones] = useState('')
  const [actualizarCatalogo, setActualizarCatalogo] = useState(true)

  // Escáner de código de barras
  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeFeedback, setBarcodeFeedback] = useState<{
    type: 'ok' | 'warn'
    text: string
    unknownCode?: string
    targetRowIdx?: number
  } | null>(null)
  const barcodeRef = useRef<HTMLInputElement>(null)

  // Ítems
  const [rows, setRows] = useState<EntradaRow[]>([createEmptyRow()])

  // Estado post-guardado para descarga inmediata de Acta PDF
  const [completedActa, setCompletedActa] = useState<{
    id: string
    radicado: string
    items_count: number
    valor_total: number
  } | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  // Totales financieros en vivo
  const totales = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        if (!r.material_id) return acc
        const c = calcLinea(r)
        return {
          subtotal: acc.subtotal + c.subtotal,
          descuento: acc.descuento + c.descuento,
          iva: acc.iva + c.iva,
          total: acc.total + c.total,
          itemsValidos: acc.itemsValidos + 1,
        }
      },
      { subtotal: 0, descuento: 0, iva: 0, total: 0, itemsValidos: 0 }
    )
  }, [rows])

  function applyMaterialToRow(idx: number, matId: string, mat?: MaterialSearchOption) {
    setRows((prev) => {
      const copy = [...prev]
      if (!matId || !mat) {
        copy[idx] = { ...copy[idx], material_id: '' }
        return copy
      }
      copy[idx] = {
        ...copy[idx],
        material_id: matId,
        codigo_barras: mat.codigo_barras || copy[idx].codigo_barras || '',
        registro_sanitario: mat.registro_sanitario || '',
        laboratorio_fabricante: mat.laboratorio_fabricante || '',
        presentacion: mat.presentacion_comercial || '',
        costo_unitario: mat.precio_unitario || 0,
        iva_porcentaje: mat.iva_porcentaje ?? 0,
        precio_venta_sugerido:
          mat.precio_venta_referencia && mat.precio_venta_referencia > 0
            ? String(mat.precio_venta_referencia)
            : '',
        condiciones_almacenamiento:
          (mat.condiciones_almacenamiento as CondicionAlmacenamiento) || 'ambiente',
        requiere_lote: mat.requiere_lote ?? true,
        requiere_vencimiento: mat.requiere_vencimiento ?? true,
      }
      return copy
    })
  }

  function updateRow<K extends keyof EntradaRow>(idx: number, field: K, value: EntradaRow[K]) {
    setRows((prev) => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], [field]: value }
      return copy
    })
  }

  // Manejo de escáner de código de barras (EAN / GS1 / código interno)
  function handleBarcodeScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const code = barcodeInput.trim()
    if (!code) return

    const found = materials.find(
      (m) =>
        (m.codigo_barras && m.codigo_barras.trim().toLowerCase() === code.toLowerCase()) ||
        m.codigo.trim().toLowerCase() === code.toLowerCase()
    )

    if (found) {
      // Buscar primera fila vacía o agregar una nueva
      const emptyIdx = rows.findIndex((r) => !r.material_id)
      if (emptyIdx >= 0) {
        applyMaterialToRow(emptyIdx, found.id, found)
      } else {
        const newRow = createEmptyRow()
        const nextIdx = rows.length
        setRows((prev) => [...prev, newRow])
        setTimeout(() => applyMaterialToRow(nextIdx, found.id, found), 0)
      }
      setBarcodeFeedback({
        type: 'ok',
        text: `Agregado: ${found.codigo} — ${found.nombre}`,
      })
      setBarcodeInput('')
    } else {
      // Si hay una fila vacía o sin código de barras, le pre-llenamos el código de barras escaneado
      const targetIdx = rows.findIndex((r) => !r.codigo_barras)
      const resolvedIdx = targetIdx >= 0 ? targetIdx : 0
      if (targetIdx >= 0) {
        updateRow(targetIdx, 'codigo_barras', code)
      }
      setBarcodeFeedback({
        type: 'warn',
        text: `Código "${code}" no encontrado en catálogo.`,
        unknownCode: code,
        targetRowIdx: resolvedIdx,
      })
      setBarcodeInput('')
    }
  }

  function openCrearInsumo(rowIdx: number, initialName = '', initialBarcode = '') {
    const currentRow = rows[rowIdx]
    setNuevoInsumoModal({
      open: true,
      targetRowIdx: rowIdx,
      initialData: {
        nombre: initialName,
        tipo_item: 'insumo',
        codigo_barras: initialBarcode || currentRow?.codigo_barras || '',
        registro_sanitario: currentRow?.registro_sanitario || '',
        laboratorio_fabricante: currentRow?.laboratorio_fabricante || '',
        presentacion_comercial: currentRow?.presentacion || '',
        condiciones_almacenamiento: currentRow?.condiciones_almacenamiento || 'ambiente',
        iva_porcentaje: currentRow?.iva_porcentaje ?? 0,
      },
    })
  }

  // Atajo Alt + N o F2 dentro del modal de recepción -> abre registro rápido para la fila libre actual
  useEffect(() => {
    function handleRecepcionKeyDown(e: KeyboardEvent) {
      if (nuevoInsumoModal.open || completedActa) return
      const isAltN = e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'n'
      const isF2 = e.key === 'F2' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey
      if (!isAltN && !isF2) return

      e.preventDefault()
      const emptyIdx = rows.findIndex((r) => !r.material_id)
      openCrearInsumo(emptyIdx >= 0 ? emptyIdx : rows.length - 1)
    }
    window.addEventListener('keydown', handleRecepcionKeyDown)
    return () => window.removeEventListener('keydown', handleRecepcionKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nuevoInsumoModal.open, completedActa, rows])

  function handleInsumoCreated(created: MaterialSearchOption) {
    setMaterials((prev) =>
      [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre))
    )

    // Seleccionar automáticamente el nuevo insumo en la fila objetivo conservando lote/cant/costo si ya los escribió
    const targetIdx = nuevoInsumoModal.targetRowIdx
    setRows((prev) => {
      const copy = [...prev]
      if (!copy[targetIdx]) {
        copy.push(createEmptyRow())
      }
      const existing = copy[targetIdx] || createEmptyRow()
      copy[targetIdx] = {
        ...existing,
        material_id: created.id,
        codigo_barras: created.codigo_barras || existing.codigo_barras || '',
        registro_sanitario: created.registro_sanitario || existing.registro_sanitario || '',
        laboratorio_fabricante: created.laboratorio_fabricante || existing.laboratorio_fabricante || '',
        presentacion: created.presentacion_comercial || existing.presentacion || '',
        iva_porcentaje: created.iva_porcentaje ?? existing.iva_porcentaje,
        condiciones_almacenamiento:
          (created.condiciones_almacenamiento as CondicionAlmacenamiento) || existing.condiciones_almacenamiento,
        requiere_lote: created.requiere_lote ?? true,
        requiere_vencimiento: created.requiere_vencimiento ?? true,
      }
      return copy
    })

    setBarcodeFeedback({
      type: 'ok',
      text: `Nuevo insumo creado y seleccionado: ${created.codigo} — ${created.nombre}`,
    })
  }

  async function handleCrearProveedor() {
    setError(null)
    if (!nuevoProv.nit.trim() || !nuevoProv.razon_social.trim()) {
      setError('Para crear el proveedor debes ingresar al menos NIT y Razón Social')
      return
    }
    setSavingProv(true)
    const res = await crearProveedorAction(nuevoProv)
    setSavingProv(false)
    if (!res.success || !res.data) {
      setError(res.error || 'No se pudo crear el proveedor')
      return
    }
    setProveedores((prev) =>
      [...prev, res.data!].sort((a, b) => a.razon_social.localeCompare(b.razon_social))
    )
    setProveedorId(res.data.id)
    setShowNuevoProv(false)
    setNuevoProv({ nit: '', razon_social: '', telefono: '', email: '', contacto_nombre: '', ciudad: '' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!farmacia?.id) {
      setError('No hay una farmacia destino seleccionada')
      return
    }

    const activeRows = rows.filter((r) => r.material_id)
    if (activeRows.length === 0) {
      setError('Debes seleccionar al menos un insumo para registrar el ingreso')
      return
    }

    // Validaciones normativas previas en cliente para feedback inmediato
    for (let i = 0; i < activeRows.length; i++) {
      const r = activeRows[i]
      const mat = materials.find((m) => m.id === r.material_id)
      const nombre = mat?.nombre || `Ítem #${i + 1}`

      if (r.cantidad <= 0) {
        setError(`La cantidad de "${nombre}" debe ser mayor a cero`)
        return
      }
      if (r.costo_unitario < 0) {
        setError(`El costo unitario de "${nombre}" no puede ser negativo`)
        return
      }
      if (r.requiere_lote && !r.numero_lote.trim()) {
        setError(`El insumo "${nombre}" requiere número de lote normativo`)
        return
      }
      if (r.requiere_vencimiento && !r.fecha_vencimiento) {
        setError(`El insumo "${nombre}" requiere fecha de vencimiento`)
        return
      }
      if (r.fecha_vencimiento && r.cumple_especificaciones && dictamen !== 'cuarentena' && dictamen !== 'rechazado') {
        const evalVto = evaluarVencimiento(r.fecha_vencimiento)
        if (evalVto.nivel === 'vencido') {
          setError(
            `"${nombre}" (Lote ${r.numero_lote || 'S/N'}) tiene fecha vencida (${r.fecha_vencimiento}). Desmarca "Cumple inspección" para ingresarlo en Cuarentena o cambia el dictamen a Rechazado.`
          )
          return
        }
      }
    }

    const itemsPayload: RecepcionNormativaItemInput[] = activeRows.map((r) => ({
      material_id: r.material_id,
      cantidad: Number(r.cantidad),
      costo_unitario: Number(r.costo_unitario),
      descuento_porcentaje: Number(r.descuento_porcentaje) || 0,
      iva_porcentaje: Number(r.iva_porcentaje) || 0,
      precio_venta_sugerido: r.precio_venta_sugerido ? Number(r.precio_venta_sugerido) : null,
      numero_lote: r.numero_lote.trim() || null,
      fecha_vencimiento: r.fecha_vencimiento || null,
      fecha_fabricacion: r.fecha_fabricacion || null,
      codigo_barras: r.codigo_barras.trim() || null,
      registro_sanitario: r.registro_sanitario.trim() || null,
      laboratorio_fabricante: r.laboratorio_fabricante.trim() || null,
      presentacion: r.presentacion.trim() || null,
      condiciones_almacenamiento: r.condiciones_almacenamiento,
      cumple_especificaciones: r.cumple_especificaciones,
      estado_recepcion: !r.cumple_especificaciones ? 'cuarentena' : 'disponible',
      actualizar_catalogo: actualizarCatalogo,
      observaciones: r.observaciones.trim() || null,
    }))

    const selectedProv = proveedores.find((p) => p.id === proveedorId)

    startTransition(async () => {
      const res = await registrarRecepcionNormativaAction({
        farmacia_id: farmacia.id,
        proveedor_id: selectedProv ? selectedProv.id : null,
        proveedor_nombre: selectedProv ? selectedProv.razon_social : proveedorManual.trim() || null,
        proveedor_nit: selectedProv ? selectedProv.nit : proveedorNitManual.trim() || null,
        tipo_documento: tipoDoc,
        numero_documento: numeroDoc.trim() || null,
        fecha_documento: fechaDoc || null,
        temperatura_recepcion: temperatura !== '' ? Number(temperatura) : null,
        humedad_recepcion: humedad !== '' ? Number(humedad) : null,
        condiciones_empaque_ok: empaqueOk,
        cadena_frio_ok: cadenaFrioOk,
        dictamen_tecnico: dictamen,
        observaciones: observaciones.trim() || null,
        items: itemsPayload,
      })

      if (!res.success || !res.data) {
        setError(res.error || 'Error al registrar la recepción')
      } else {
        setCompletedActa(res.data)
      }
    })
  }

  async function handleDescargarActaPDF() {
    if (!completedActa) return
    setDownloadingPdf(true)
    const res = await obtenerDetalleRecepcionAction(completedActa.id)
    setDownloadingPdf(false)
    if (res.success && res.data) {
      generarActaRecepcionPDF(res.data)
    } else {
      alert(res.error || 'No se pudo generar el PDF del acta')
    }
  }

  // Vista de confirmación post-registro con descarga de Acta PDF
  if (completedActa) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-3xl">
            ✅
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Recepción Técnica Registrada</h3>
            <p className="text-sm text-emerald-400 font-mono font-bold mt-1">
              Acta Nº {completedActa.radicado}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Se procesaron <strong className="text-white">{completedActa.items_count}</strong> ítem(s) por un valor total de{' '}
              <strong className="text-emerald-400">{fmtCOP(completedActa.valor_total)}</strong>. Los lotes aprobados ya fueron cargados al stock y al Kardex.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleDescargarActaPDF}
              disabled={downloadingPdf}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg shadow-sky-600/20 transition-all"
            >
              <span>📄</span>
              <span>{downloadingPdf ? 'Generando PDF...' : 'Descargar Acta Técnica (PDF)'}</span>
            </button>
            <button
              type="button"
              onClick={onSuccessReload}
              className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-all"
            >
              Finalizar y Ver Stock
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      data-recepcion-modal-open="true"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[94vh]">
        {/* Header fijo */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-lg font-bold text-white">
                Registrar Entrada / Recepción Técnica de Insumos
              </h3>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/25 text-[10px] font-semibold text-sky-400 uppercase tracking-wider">
                Res. 1403/2007 · INVIMA
              </span>
            </div>
            <p className="text-xs text-emerald-400 font-mono mt-0.5">
              Destino: {farmacia?.codigo} — {farmacia?.nombre}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Contenido scrollable */}
        <form id="form-recepcion-normativa" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-start gap-2">
              <span className="text-base leading-none">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* SECCIÓN 1: PROVEEDOR Y DOCUMENTO SOPORTE */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span>🏢</span>
                <span>1. Datos Administrativos, Proveedor y Documento Soporte</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowNuevoProv((v) => !v)}
                className="text-xs text-sky-400 hover:text-sky-300 font-semibold transition-colors"
              >
                {showNuevoProv ? '− Ocultar registro proveedor' : '+ Nuevo Proveedor'}
              </button>
            </div>

            {/* Mini-formulario inline para crear proveedor rápido */}
            {showNuevoProv && (
              <div className="p-3.5 bg-sky-950/20 border border-sky-500/30 rounded-xl space-y-3">
                <p className="text-xs font-semibold text-sky-300">Registro Rápido de Proveedor</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    value={nuevoProv.nit}
                    onChange={(e) => setNuevoProv({ ...nuevoProv, nit: e.target.value })}
                    placeholder="NIT / CC * (Ej: 900123456-1)"
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                  />
                  <input
                    type="text"
                    value={nuevoProv.razon_social}
                    onChange={(e) => setNuevoProv({ ...nuevoProv, razon_social: e.target.value })}
                    placeholder="Razón Social * (Ej: Depósito Dental S.A.S)"
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white sm:col-span-2"
                  />
                  <input
                    type="text"
                    value={nuevoProv.contacto_nombre}
                    onChange={(e) => setNuevoProv({ ...nuevoProv, contacto_nombre: e.target.value })}
                    placeholder="Persona de contacto"
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                  />
                  <input
                    type="text"
                    value={nuevoProv.telefono}
                    onChange={(e) => setNuevoProv({ ...nuevoProv, telefono: e.target.value })}
                    placeholder="Teléfono"
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                  />
                  <input
                    type="email"
                    value={nuevoProv.email}
                    onChange={(e) => setNuevoProv({ ...nuevoProv, email: e.target.value })}
                    placeholder="Correo electrónico"
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNuevoProv(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCrearProveedor}
                    disabled={savingProv}
                    className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                  >
                    {savingProv ? 'Guardando...' : 'Guardar Proveedor'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Proveedor Registrado
                </label>
                <select
                  value={proveedorId}
                  onChange={(e) => setProveedorId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  <option value="">— Proveedor ocasional / digitar abajo —</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.razon_social} (NIT: {p.nit})
                    </option>
                  ))}
                </select>
              </div>

              {!proveedorId && (
                <>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Nombre Proveedor
                    </label>
                    <input
                      type="text"
                      value={proveedorManual}
                      onChange={(e) => setProveedorManual(e.target.value)}
                      placeholder="Ej: Depósito Dental S.A."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      NIT Proveedor
                    </label>
                    <input
                      type="text"
                      value={proveedorNitManual}
                      onChange={(e) => setProveedorNitManual(e.target.value)}
                      placeholder="900.123.456-1"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>
                </>
              )}

              <div className={proveedorId ? 'sm:col-span-3' : 'sm:col-span-3'}>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Tipo de Documento
                </label>
                <select
                  value={tipoDoc}
                  onChange={(e) => setTipoDoc(e.target.value as TipoDocumentoRecepcion)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  {Object.entries(TIPO_DOC_RECEPCION_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={proveedorId ? 'sm:col-span-3' : 'sm:col-span-6'}>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Nº Factura / Remisión <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={numeroDoc}
                  onChange={(e) => setNumeroDoc(e.target.value)}
                  placeholder="Ej: FE-98234"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div className={proveedorId ? 'sm:col-span-2' : 'sm:col-span-6'}>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Fecha Documento
                </label>
                <input
                  type="date"
                  value={fechaDoc}
                  onChange={(e) => setFechaDoc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: RECEPCIÓN TÉCNICA Y CONDICIONES AMBIENTALES */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span>🌡️</span>
              <span>2. Inspección Técnica y Condiciones de Recepción (Res. 1403/2007)</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 items-end">
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Temperatura (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={temperatura}
                  onChange={(e) => setTemperatura(e.target.value)}
                  placeholder="Ej: 21.5"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white text-right"
                />
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Humedad Rel. (%)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={humedad}
                  onChange={(e) => setHumedad(e.target.value)}
                  placeholder="Ej: 55"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white text-right"
                />
              </div>

              <div className="col-span-2 sm:col-span-4">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Dictamen Técnico General
                </label>
                <select
                  value={dictamen}
                  onChange={(e) => setDictamen(e.target.value as DictamenTecnico)}
                  className={`w-full px-3 py-2 bg-slate-900 border rounded-xl text-xs font-semibold ${
                    dictamen === 'rechazado'
                      ? 'border-red-500/50 text-red-400'
                      : dictamen === 'cuarentena'
                      ? 'border-amber-500/50 text-amber-400'
                      : 'border-emerald-500/40 text-emerald-400'
                  }`}
                >
                  {Object.entries(DICTAMEN_TECNICO_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 sm:col-span-4 flex flex-col gap-1.5 pb-1">
                <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={empaqueOk}
                    onChange={(e) => setEmpaqueOk(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500/40"
                  />
                  <span>Empaque, sellos y rotulado íntegros</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cadenaFrioOk}
                    onChange={(e) => setCadenaFrioOk(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500/40"
                  />
                  <span>Cadena de frío cumplida (si aplica)</span>
                </label>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: INSUMOS + ESCÁNER CÓDIGO DE BARRAS */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span>📦</span>
                  <span>
                    3. Insumos, Lotes, Vencimientos, Código de Barras y Precios <span className="text-red-400">*</span>
                  </span>
                </h4>
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={actualizarCatalogo}
                    onChange={(e) => setActualizarCatalogo(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-900 text-sky-500"
                  />
                  <span>Guardar Cód. Barras / INVIMA en catálogo</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const emptyIdx = rows.findIndex((r) => !r.material_id)
                    openCrearInsumo(emptyIdx >= 0 ? emptyIdx : 0)
                  }}
                  title="Atajo de teclado: Alt + N o F2"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30 rounded-lg text-xs font-semibold transition-colors"
                >
                  <span>+ Nuevo Insumo</span>
                  <kbd className="px-1 py-0.5 rounded bg-slate-950/90 border border-sky-500/30 text-[10px] font-mono text-sky-300">
                    Alt+N
                  </kbd>
                </button>
                <button
                  type="button"
                  onClick={() => setRows((prev) => [...prev, createEmptyRow()])}
                  className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-colors"
                >
                  + Agregar fila
                </button>
              </div>
            </div>

            {/* Barra de Escáner de Código de Barras */}
            <div className="p-3 bg-slate-950 border border-sky-500/25 rounded-xl flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold shrink-0">
                <span className="text-base">🔦</span>
                <span>Escáner Cód. Barras:</span>
              </div>
              <input
                ref={barcodeRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeScan}
                placeholder="Escanea con lector USB o escribe EAN-13 / código interno y presiona Enter..."
                className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
              {barcodeFeedback && (
                <div
                  className={`flex flex-wrap items-center gap-2 text-[11px] px-2.5 py-1 rounded-lg border ${
                    barcodeFeedback.type === 'ok'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  }`}
                >
                  <span>{barcodeFeedback.text}</span>
                  {barcodeFeedback.unknownCode && (
                    <button
                      type="button"
                      onClick={() =>
                        openCrearInsumo(
                          barcodeFeedback.targetRowIdx ?? 0,
                          '',
                          barcodeFeedback.unknownCode
                        )
                      }
                      className="px-2 py-0.5 bg-sky-600 hover:bg-sky-500 text-white rounded font-semibold transition-colors"
                    >
                      + Crear insumo con este código
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Tarjetas de cada ítem */}
            <div className="space-y-3">
              {rows.map((row, idx) => {
                const linea = calcLinea(row)
                const vtoEval = row.fecha_vencimiento ? evaluarVencimiento(row.fecha_vencimiento) : null

                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border space-y-3 transition-colors ${
                      !row.cumple_especificaciones
                        ? 'bg-amber-950/15 border-amber-500/40'
                        : vtoEval?.nivel === 'vencido'
                        ? 'bg-red-950/15 border-red-500/40'
                        : 'bg-slate-950/70 border-slate-800'
                    }`}
                  >
                    {/* Cabecera de fila */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px] font-bold">
                          #{idx + 1}
                        </span>
                        {vtoEval && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${vtoEval.badgeClass}`}>
                            {vtoEval.label}
                          </span>
                        )}
                        {!row.cumple_especificaciones && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            ⚠️ Ingresará a CUARENTENA
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={row.cumple_especificaciones}
                            onChange={(e) => updateRow(idx, 'cumple_especificaciones', e.target.checked)}
                            className="rounded border-slate-600 bg-slate-900 text-emerald-500"
                          />
                          <span>Cumple inspección física</span>
                        </label>

                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-xs text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-red-500/10"
                            title="Eliminar fila"
                          >
                            ✕ Quitar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Sub-fila 1: Insumo + Código Barras + INVIMA + Fabricante */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div className="sm:col-span-5">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase">
                          Insumo / Material <span className="text-red-400">*</span>
                        </label>
                        <div className="flex items-stretch gap-1.5">
                          <div className="flex-1 min-w-0">
                            <InsumoSearchSelect
                              materials={materials}
                              value={row.material_id}
                              onChange={(matId, found) => applyMaterialToRow(idx, matId, found)}
                              onCreateNew={(query) => openCrearInsumo(idx, query)}
                              placeholder="Buscar o crear insumo..."
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => openCrearInsumo(idx)}
                            title="Registrar nuevo insumo en el catálogo"
                            className="shrink-0 px-2.5 bg-slate-800 hover:bg-sky-600/25 border border-slate-700 hover:border-sky-500/50 text-sky-400 rounded-lg text-sm font-bold transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase">
                          Código de Barras (EAN / GS1)
                        </label>
                        <input
                          type="text"
                          value={row.codigo_barras}
                          onChange={(e) => updateRow(idx, 'codigo_barras', e.target.value)}
                          placeholder="Ej: 7701234567890"
                          className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white placeholder-slate-600"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase">
                          Reg. Sanitario INVIMA
                        </label>
                        <input
                          type="text"
                          value={row.registro_sanitario}
                          onChange={(e) => updateRow(idx, 'registro_sanitario', e.target.value)}
                          placeholder="2023DM-0021..."
                          className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase">
                          Fabricante / Marca
                        </label>
                        <input
                          type="text"
                          value={row.laboratorio_fabricante}
                          onChange={(e) => updateRow(idx, 'laboratorio_fabricante', e.target.value)}
                          placeholder="Ej: 3M, Septodont"
                          className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600"
                        />
                      </div>
                    </div>

                    {/* Sub-fila 2: Lote + Fechas + Presentación + Almacenamiento */}
                    <div className="grid grid-cols-2 sm:grid-cols-12 gap-2.5">
                      <div className="col-span-1 sm:col-span-2">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase">
                          Nº Lote {row.requiere_lote && <span className="text-red-400">*</span>}
                        </label>
                        <input
                          type="text"
                          value={row.numero_lote}
                          onChange={(e) => updateRow(idx, 'numero_lote', e.target.value.toUpperCase())}
                          placeholder="Ej: LOT-26A"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white uppercase placeholder-slate-600"
                        />
                      </div>

                      <div className="col-span-1 sm:col-span-3">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase">
                          Fecha Vencimiento {row.requiere_vencimiento && <span className="text-red-400">*</span>}
                        </label>
                        <input
                          type="date"
                          value={row.fecha_vencimiento}
                          onChange={(e) => updateRow(idx, 'fecha_vencimiento', e.target.value)}
                          className={`w-full px-2.5 py-1.5 bg-slate-900 border rounded-lg text-xs text-white ${
                            vtoEval?.nivel === 'vencido'
                              ? 'border-red-500 text-red-300'
                              : vtoEval?.nivel === 'critico'
                              ? 'border-orange-500 text-orange-300'
                              : 'border-slate-700'
                          }`}
                        />
                      </div>

                      <div className="col-span-1 sm:col-span-2">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase">
                          F. Fabricación
                        </label>
                        <input
                          type="date"
                          value={row.fecha_fabricacion}
                          onChange={(e) => updateRow(idx, 'fecha_fabricacion', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                        />
                      </div>

                      <div className="col-span-1 sm:col-span-2">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase">
                          Presentación
                        </label>
                        <input
                          type="text"
                          value={row.presentacion}
                          onChange={(e) => updateRow(idx, 'presentacion', e.target.value)}
                          placeholder="Caja x 50, Jeringa..."
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-3">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase">
                          Condición Almacenamiento
                        </label>
                        <select
                          value={row.condiciones_almacenamiento}
                          onChange={(e) =>
                            updateRow(idx, 'condiciones_almacenamiento', e.target.value as CondicionAlmacenamiento)
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                        >
                          {Object.entries(CONDICION_ALMACENAMIENTO_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Sub-fila 3: Cantidades, Costos, Descuento, IVA, Precio Venta y Total */}
                    <div className="grid grid-cols-2 sm:grid-cols-12 gap-2.5 items-end pt-1">
                      <div className="col-span-1 sm:col-span-2">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase">
                          Cantidad <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={row.cantidad}
                          onChange={(e) => updateRow(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white text-right"
                        />
                      </div>

                      <div className="col-span-1 sm:col-span-2">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase">
                          Costo Unit. (COP) <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          required
                          value={row.costo_unitario}
                          onChange={(e) => updateRow(idx, 'costo_unitario', parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white text-right"
                        />
                      </div>

                      <div className="col-span-1 sm:col-span-1">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase">
                          Desc %
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={row.descuento_porcentaje}
                          onChange={(e) =>
                            updateRow(idx, 'descuento_porcentaje', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white text-right"
                        />
                      </div>

                      <div className="col-span-1 sm:col-span-2">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase">
                          IVA (%)
                        </label>
                        <select
                          value={row.iva_porcentaje}
                          onChange={(e) => updateRow(idx, 'iva_porcentaje', parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                        >
                          <option value={0}>0% (Exento / Excluido)</option>
                          <option value={5}>5% (Tarifa reducida)</option>
                          <option value={19}>19% (Tarifa general)</option>
                        </select>
                      </div>

                      <div className="col-span-1 sm:col-span-2">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase">
                          P. Venta Ref. (Opc.)
                        </label>
                        <input
                          type="number"
                          step="100"
                          min="0"
                          value={row.precio_venta_sugerido}
                          onChange={(e) => updateRow(idx, 'precio_venta_sugerido', e.target.value)}
                          placeholder="Opcional"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white text-right placeholder-slate-600"
                        />
                      </div>

                      <div className="col-span-1 sm:col-span-3">
                        <div className="px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg text-right">
                          <span className="block text-[10px] text-slate-500">
                            Total Línea {linea.iva > 0 ? `(IVA ${fmtCOP(linea.iva)})` : '(Sin IVA)'}
                          </span>
                          <span className="text-sm font-bold font-mono text-emerald-400">
                            {fmtCOP(linea.total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* SECCIÓN 4: OBSERVACIONES */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Observaciones de la Recepción Técnica / Novedades
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Ej: Certificados de análisis verificados, sellos de seguridad conformes, novedades del transportador..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>
        </form>

        {/* Footer fijo con Resumen Financiero y Acciones */}
        <div className="px-6 py-4 bg-slate-950/90 border-t border-slate-800 rounded-b-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
            <div>
              <span className="text-slate-500">Ítems: </span>
              <span className="font-bold text-white">{totales.itemsValidos}</span>
            </div>
            <div>
              <span className="text-slate-500">Subtotal: </span>
              <span className="font-mono text-slate-300">{fmtCOP(totales.subtotal)}</span>
            </div>
            {totales.descuento > 0 && (
              <div>
                <span className="text-slate-500">Desc.: </span>
                <span className="font-mono text-amber-400">-{fmtCOP(totales.descuento)}</span>
              </div>
            )}
            <div>
              <span className="text-slate-500">IVA: </span>
              <span className="font-mono text-sky-400">{fmtCOP(totales.iva)}</span>
            </div>
            <div className="pl-2 border-l border-slate-800">
              <span className="text-slate-400 font-medium">Total Compra: </span>
              <span className="text-base font-bold font-mono text-emerald-400">
                {fmtCOP(totales.total)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-recepcion-normativa"
              disabled={isPending}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
            >
              {isPending ? 'Registrando Acta...' : 'Confirmar Ingreso y Generar Acta'}
            </button>
          </div>
        </div>
      </div>

      {/* SUB-MODAL: CREACIÓN RÁPIDA DE NUEVO INSUMO EN CATÁLOGO (Atajo Alt+N / F2) */}
      <CrearInsumoRapidoModal
        isOpen={nuevoInsumoModal.open}
        onClose={() => setNuevoInsumoModal({ open: false, targetRowIdx: 0 })}
        onCreated={handleInsumoCreated}
        categorias={categorias}
        unidades={unidades}
        initialData={nuevoInsumoModal.initialData}
        targetRowLabel={`fila #${nuevoInsumoModal.targetRowIdx + 1}`}
      />
    </div>
  )
}
