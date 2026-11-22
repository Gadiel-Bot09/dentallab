// src/lib/farmacia-pdf.ts
// Generación de Acta de Recepción Técnica y Administrativa en PDF
// Conforme a Resolución 1403/2007, Decreto 4725/2005 y Res. 3100/2019 (Colombia)
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  CONDICION_ALMACENAMIENTO_LABELS,
  DICTAMEN_TECNICO_LABELS,
  TIPO_DOC_RECEPCION_LABELS,
  type RecepcionFarmacia,
} from '@/types/farmacia'

function fmtCOP(v: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(v || 0)
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function generarActaRecepcionPDF(recepcion: RecepcionFarmacia) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Encabezado Institucional
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, 297, 26, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.text('ACTA DE RECEPCIÓN TÉCNICA Y ADMINISTRATIVA DE INSUMOS', 14, 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(203, 213, 225)
  doc.text(
    'Control Farmacéutico y de Dispositivos Médicos · Res. 1403/2007 · Decreto 4725/2005 · Res. 3100/2019',
    14,
    17
  )
  doc.text(
    `Farmacia Destino: ${recepcion.farmacia?.codigo ?? ''} — ${recepcion.farmacia?.nombre ?? ''}`,
    14,
    22.5
  )

  // Badge del radicado a la derecha
  doc.setFillColor(16, 185, 129)
  doc.roundedRect(235, 6, 48, 14, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(recepcion.radicado, 259, 12.5, { align: 'center' })
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.text('ACTA DE RECEPCIÓN', 259, 17.5, { align: 'center' })

  // Bloques de información administrativa y técnica
  autoTable(doc, {
    startY: 31,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.2, textColor: [30, 41, 59] },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    head: [['DATOS ADMINISTRATIVOS Y DEL PROVEEDOR', 'CONDICIONES TÉCNICAS Y AMBIENTALES DE RECEPCIÓN']],
    body: [
      [
        `Proveedor: ${recepcion.proveedor_nombre || 'No especificado'}   |   NIT: ${recepcion.proveedor_nit || 'N/A'}\n` +
          `Documento: ${TIPO_DOC_RECEPCION_LABELS[recepcion.tipo_documento] || recepcion.tipo_documento} Nº ${recepcion.numero_documento || 'S/N'}\n` +
          `Fecha Documento: ${fmtDate(recepcion.fecha_documento)}   |   Fecha Recepción: ${fmtDate(recepcion.fecha_recepcion)}\n` +
          `Recibido por: ${recepcion.usuario_recibe ? `${recepcion.usuario_recibe.nombre} ${recepcion.usuario_recibe.apellido}` : 'Usuario sistema'}`,
        `Temperatura Recepción: ${recepcion.temperatura_recepcion != null ? `${recepcion.temperatura_recepcion} °C` : 'No registrada'}   |   Humedad Relativa: ${recepcion.humedad_recepcion != null ? `${recepcion.humedad_recepcion} %` : 'No registrada'}\n` +
          `Integridad de Empaque / Rotulado: ${recepcion.condiciones_empaque_ok ? 'CUMPLE (OK)' : 'NO CUMPLE (CON NOVEDAD)'}\n` +
          `Cadena de Frío (si aplica): ${recepcion.cadena_frio_ok ? 'CUMPLE (OK)' : 'NO CUMPLE'}\n` +
          `Dictamen Técnico Final: ${(DICTAMEN_TECNICO_LABELS[recepcion.dictamen_tecnico] || recepcion.dictamen_tecnico).toUpperCase()}`,
      ],
    ],
  })

  // Tabla de Insumos Recibidos
  const startItemsY = ((doc as any).lastAutoTable?.finalY ?? 62) + 5
  const rows = (recepcion.items ?? []).map((it, idx) => [
    String(idx + 1),
    `${it.material?.codigo ?? ''}\n${it.material?.nombre ?? 'Insumo'}`,
    it.codigo_barras || '—',
    it.numero_lote || 'SIN-LOTE',
    fmtDate(it.fecha_vencimiento),
    it.registro_sanitario || '—',
    [it.laboratorio_fabricante, it.presentacion].filter(Boolean).join(' / ') || '—',
    CONDICION_ALMACENAMIENTO_LABELS[it.condiciones_almacenamiento]?.split(' ')[0] || it.condiciones_almacenamiento,
    String(it.cantidad),
    fmtCOP(it.costo_unitario),
    `${it.iva_porcentaje || 0}%`,
    fmtCOP(it.valor_total),
    it.estado_recepcion === 'disponible'
      ? 'APROBADO'
      : it.estado_recepcion === 'cuarentena'
      ? 'CUARENTENA'
      : 'RECHAZADO',
  ])

  autoTable(doc, {
    startY: startItemsY,
    theme: 'striped',
    styles: { fontSize: 7.2, cellPadding: 1.8, textColor: [15, 23, 42], valign: 'middle' },
    headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { cellWidth: 42 },
      2: { cellWidth: 24, font: 'courier' },
      3: { cellWidth: 22, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 19 },
      5: { cellWidth: 26 },
      6: { cellWidth: 32 },
      7: { halign: 'center', cellWidth: 17 },
      8: { halign: 'right', cellWidth: 13 },
      9: { halign: 'right', cellWidth: 20 },
      10: { halign: 'center', cellWidth: 11 },
      11: { halign: 'right', cellWidth: 22, fontStyle: 'bold' },
      12: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
    },
    head: [[
      '#',
      'Insumo / Código',
      'Cód. Barras',
      'Nº Lote',
      'Vencimiento',
      'Reg. INVIMA',
      'Fabricante / Pres.',
      'Almac.',
      'Cant.',
      'Costo Unit.',
      'IVA',
      'Total Línea',
      'Estado',
    ]],
    body: rows,
  })

  // Resumen financiero y observaciones
  const afterTableY = ((doc as any).lastAutoTable?.finalY ?? 120) + 4
  autoTable(doc, {
    startY: afterTableY,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.2 },
    headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 165 },
      1: { halign: 'right', cellWidth: 27 },
      2: { halign: 'right', cellWidth: 27 },
      3: { halign: 'right', cellWidth: 25 },
      4: { halign: 'right', cellWidth: 29, fontStyle: 'bold', textColor: [5, 150, 105] },
    },
    head: [['OBSERVACIONES DE LA RECEPCIÓN', 'SUBTOTAL', 'DESCUENTOS', 'IVA', 'VALOR TOTAL']],
    body: [[
      recepcion.observaciones || 'Sin novedades adicionales reportadas durante la inspección técnica.',
      fmtCOP(recepcion.subtotal),
      fmtCOP(recepcion.descuento_total),
      fmtCOP(recepcion.iva_total),
      fmtCOP(recepcion.valor_total),
    ]],
  })

  // Espacio de firmas reglamentarias
  let firmasY = ((doc as any).lastAutoTable?.finalY ?? 155) + 18
  if (firmasY > 185) {
    doc.addPage()
    firmasY = 35
  }

  doc.setDrawColor(100, 116, 139)
  doc.setLineWidth(0.3)
  doc.setFontSize(8)
  doc.setTextColor(51, 65, 85)

  // Firma 1: Quien recibe
  doc.line(20, firmasY, 95, firmasY)
  doc.setFont('helvetica', 'bold')
  doc.text('RECIBIDO Y VERIFICADO POR (FARMACIA)', 57.5, firmasY + 4.5, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.text(
    recepcion.usuario_recibe ? `${recepcion.usuario_recibe.nombre} ${recepcion.usuario_recibe.apellido}` : 'Responsable de Farmacia',
    57.5,
    firmasY + 9,
    { align: 'center' }
  )

  // Firma 2: Director Técnico / Químico Farmacéutico
  doc.line(112, firmasY, 187, firmasY)
  doc.setFont('helvetica', 'bold')
  doc.text('Vº Bº DIRECCIÓN TÉCNICA / CALIDAD', 149.5, firmasY + 4.5, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.text('Firma y Registro Profesional', 149.5, firmasY + 9, { align: 'center' })

  // Firma 3: Proveedor / Transportador
  doc.line(204, firmasY, 279, firmasY)
  doc.setFont('helvetica', 'bold')
  doc.text('ENTREGADO POR (PROVEEDOR)', 241.5, firmasY + 4.5, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.text(recepcion.proveedor_nombre || 'Representante / Transportador', 241.5, firmasY + 9, { align: 'center' })

  // Pie de página
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `DentalLab Manager · Acta ${recepcion.radicado} · Generado el ${new Date().toLocaleString('es-CO')} · Página ${i} de ${pageCount}`,
      148.5,
      204,
      { align: 'center' }
    )
  }

  doc.save(`Acta_Recepcion_${recepcion.radicado}.pdf`)
}
