'use client'
// src/app/(interno)/farmacia/reportes/_components/FarmaciaReportesClient.tsx
import { useState } from 'react'
import type { Area, Farmacia } from '@/types/database'
import ExcelJS from 'exceljs'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface ConsumoAreaRow {
  area_id: string
  area_codigo: string
  area_nombre: string
  centro_costo: string
  cant_despachada: number
  cant_devuelta: number
  valor_despachado: number
  valor_devuelto: number
  gasto_neto: number
}

export interface ConsumoInsumoRow {
  material_id: string
  material_codigo: string
  material_nombre: string
  categoria: string
  unidad: string
  cantidad_neta: number
  valor_neto: number
}

interface Props {
  areas: Area[]
  farmacias: Farmacia[]
  consumoPorArea: ConsumoAreaRow[]
  topInsumos: ConsumoInsumoRow[]
  totales: {
    gastoNeto: number
    valorDespachado: number
    valorDevuelto: number
    cantDespachada: number
    cantDevuelta: number
    totalSolicitudes: number
  }
  filtros: {
    desde: string
    hasta: string
    farmaciaId: string
    areaId: string
  }
  userName: string
}

function fmtCOP(v: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(v || 0)
}

export default function FarmaciaReportesClient({
  areas,
  farmacias,
  consumoPorArea,
  topInsumos,
  totales,
  filtros,
  userName,
}: Props) {
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [isExportingPDF, setIsExportingPDF] = useState(false)

  const tasaDevolucion =
    totales.valorDespachado > 0
      ? ((totales.valorDevuelto / totales.valorDespachado) * 100).toFixed(1)
      : '0.0'

  // EXPORTAR A EXCEL
  async function exportToExcel() {
    try {
      setIsExportingExcel(true)
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'DentalLab Manager'
      workbook.created = new Date()

      // HOJA 1: Consumo por Área
      const sheetArea = workbook.addWorksheet('Gasto por Área')

      // Título
      sheetArea.mergeCells('A1:G1')
      const titleCell = sheetArea.getCell('A1')
      titleCell.value = 'DENTALLAB — REPORTE DE GASTO EN INSUMOS POR ÁREA'
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } }
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
      sheetArea.getRow(1).height = 30

      sheetArea.mergeCells('A2:G2')
      const subTitleCell = sheetArea.getCell('A2')
      subTitleCell.value = `Período: ${filtros.desde} al ${filtros.hasta} | Generado por: ${userName}`
      subTitleCell.font = { name: 'Arial', size: 10, italic: true }
      subTitleCell.alignment = { vertical: 'middle', horizontal: 'center' }

      sheetArea.addRow([]) // Espacio

      // Encabezados
      const headerRow = sheetArea.addRow([
        'Código Área',
        'Nombre del Área',
        'Centro de Costo',
        'Cant. Despachada',
        'Cant. Devuelta',
        'Valor Despachado (COP)',
        'Valor Devuelto (COP)',
        'Gasto Neto (COP)',
      ])
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        }
      })

      // Filas de datos
      consumoPorArea.forEach((r) => {
        const row = sheetArea.addRow([
          r.area_codigo,
          r.area_nombre,
          r.centro_costo || '-',
          r.cant_despachada,
          r.cant_devuelta,
          r.valor_despachado,
          r.valor_devuelto,
          r.gasto_neto,
        ])
        row.getCell(4).numFmt = '#,##0.00'
        row.getCell(5).numFmt = '#,##0.00'
        row.getCell(6).numFmt = '"$"#,##0'
        row.getCell(7).numFmt = '"$"#,##0'
        row.getCell(8).numFmt = '"$"#,##0'
      })

      // Fila de totales
      const totalRow = sheetArea.addRow([
        'TOTAL GENERAL',
        '',
        '',
        totales.cantDespachada,
        totales.cantDevuelta,
        totales.valorDespachado,
        totales.valorDevuelto,
        totales.gastoNeto,
      ])
      totalRow.font = { bold: true }
      totalRow.getCell(6).numFmt = '"$"#,##0'
      totalRow.getCell(7).numFmt = '"$"#,##0'
      totalRow.getCell(8).numFmt = '"$"#,##0'

      sheetArea.columns.forEach((col) => {
        col.width = 22
      })

      // HOJA 2: Top Insumos
      const sheetInsumos = workbook.addWorksheet('Top Insumos')
      sheetInsumos.addRow(['Código', 'Insumo', 'Categoría', 'Unidad', 'Cantidad Consumida', 'Gasto Total (COP)'])
      sheetInsumos.getRow(1).font = { bold: true }

      topInsumos.forEach((r) => {
        const row = sheetInsumos.addRow([
          r.material_codigo,
          r.material_nombre,
          r.categoria,
          r.unidad,
          r.cantidad_neta,
          r.valor_neto,
        ])
        row.getCell(5).numFmt = '#,##0.00'
        row.getCell(6).numFmt = '"$"#,##0'
      })
      sheetInsumos.columns.forEach((col) => {
        col.width = 22
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Reporte_Farmacia_${filtros.desde}_${filtros.hasta}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert('Error generando Excel: ' + err.message)
    } finally {
      setIsExportingExcel(false)
    }
  }

  // EXPORTAR A PDF
  function exportToPDF() {
    try {
      setIsExportingPDF(true)
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      // Encabezado
      doc.setFillColor(2, 132, 199)
      doc.rect(0, 0, 297, 24, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(255, 255, 255)
      doc.text('DENTALLAB MANAGER — REPORTE DE GASTO EN INSUMOS POR ÁREA', 14, 12)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `Período analizado: ${filtros.desde} al ${filtros.hasta}   |   Fecha de emisión: ${new Date().toLocaleDateString('es-CO')}   |   Generado por: ${userName}`,
        14,
        19
      )

      // KPIs Resumen
      doc.setFontSize(10)
      doc.setTextColor(30, 41, 59)
      doc.setFont('helvetica', 'bold')
      doc.text('Resumen Ejecutivo de Indicadores:', 14, 32)

      autoTable(doc, {
        startY: 35,
        theme: 'grid',
        head: [['Gasto Neto Total', 'Valor Despachado', 'Valor Devuelto', 'Tasa Devolución', 'Insumos Despachados']],
        body: [[
          fmtCOP(totales.gastoNeto),
          fmtCOP(totales.valorDespachado),
          fmtCOP(totales.valorDevuelto),
          `${tasaDevolucion}%`,
          totales.cantDespachada.toLocaleString('es-CO'),
        ]],
        styles: { fontSize: 9, halign: 'center', textColor: [30, 41, 59] },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      })

      // Tabla de Consumo por Área
      const startYArea = (doc as any).lastAutoTable.finalY + 8
      doc.text('Distribución de Consumo y Gasto por Área Asistencial:', 14, startYArea)

      const areaRows = consumoPorArea.map((r) => [
        r.area_codigo,
        r.area_nombre,
        r.centro_costo || '-',
        r.cant_despachada.toLocaleString('es-CO'),
        r.cant_devuelta.toLocaleString('es-CO'),
        fmtCOP(r.valor_despachado),
        fmtCOP(r.valor_devuelto),
        fmtCOP(r.gasto_neto),
      ])

      autoTable(doc, {
        startY: startYArea + 3,
        theme: 'striped',
        head: [[
          'Código',
          'Área',
          'C. Costo',
          'Cant. Desp.',
          'Cant. Dev.',
          'Val. Despachado',
          'Val. Devuelto',
          'Gasto Neto Total',
        ]],
        body: areaRows,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { fontStyle: 'bold', halign: 'center' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right', fontStyle: 'bold' },
        },
      })

      // Nueva página para Top Insumos si es necesario
      doc.addPage()
      doc.text('Top Insumos con Mayor Consumo en el Período:', 14, 15)

      const insumoRows = topInsumos.map((i) => [
        i.material_codigo,
        i.material_nombre,
        i.categoria,
        i.unidad,
        i.cantidad_neta.toLocaleString('es-CO'),
        fmtCOP(i.valor_neto),
      ])

      autoTable(doc, {
        startY: 20,
        theme: 'striped',
        head: [['Código', 'Insumo', 'Categoría', 'Unidad', 'Cant. Neta', 'Gasto Total Valorizado']],
        body: insumoRows,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { fontStyle: 'bold', halign: 'center' },
          4: { halign: 'right' },
          5: { halign: 'right', fontStyle: 'bold' },
        },
      })

      // Pie de página con numeración
      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text(`Página ${i} de ${pageCount} — DentalLab Manager`, 14, 205)
      }

      doc.save(`Reporte_Farmacia_${filtros.desde}_${filtros.hasta}.pdf`)
    } catch (err: any) {
      alert('Error generando PDF: ' + err.message)
    } finally {
      setIsExportingPDF(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Botones de Exportación Superiores */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>📊</span>
            <span>Tablero de Indicadores y Gasto Institucional</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Analiza el consumo por área, devoluciones y exporta para gerencia o contabilidad.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            disabled={isExportingExcel}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
          >
            <span>📗</span>
            <span>{isExportingExcel ? 'Generando...' : 'Exportar a Excel'}</span>
          </button>
          <button
            onClick={exportToPDF}
            disabled={isExportingPDF}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-medium text-xs rounded-xl shadow-lg shadow-rose-600/20 transition-all"
          >
            <span>📕</span>
            <span>{isExportingPDF ? 'Generando...' : 'Exportar a PDF'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-900 border border-emerald-500/20">
          <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">
            Gasto Total Neto Insumos
          </p>
          <p className="text-2xl font-bold text-white mt-1.5 font-mono">
            {fmtCOP(totales.gastoNeto)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Despachos − Devoluciones
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Valor Despachado
          </p>
          <p className="text-2xl font-bold text-sky-400 mt-1.5 font-mono">
            {fmtCOP(totales.valorDespachado)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {totales.cantDespachada.toLocaleString('es-CO')} unidades entregadas
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Valor Devuelto a Farmacia
          </p>
          <p className="text-2xl font-bold text-amber-400 mt-1.5 font-mono">
            {fmtCOP(totales.valorDevuelto)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {totales.cantDevuelta.toLocaleString('es-CO')} unidades reingresadas
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Tasa de Devolución
          </p>
          <p className="text-2xl font-bold text-purple-400 mt-1.5 font-mono">
            {tasaDevolucion}%
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Proporción devuelto / despachado
          </p>
        </div>
      </div>

      {/* Tabla Indicador: Gasto por Área */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>🏢</span>
            <span>Indicador de Gasto por Área Asistencial</span>
          </h3>
          <span className="text-xs text-slate-500">
            {consumoPorArea.length} áreas con movimientos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Área</th>
                <th className="px-4 py-3">C. Costo</th>
                <th className="px-4 py-3 text-right">Cant. Despachada</th>
                <th className="px-4 py-3 text-right">Cant. Devuelta</th>
                <th className="px-4 py-3 text-right">Valor Despachado</th>
                <th className="px-4 py-3 text-right">Valor Devuelto</th>
                <th className="px-4 py-3 text-right">Gasto Neto Total</th>
                <th className="px-4 py-3 text-right">% Participación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {consumoPorArea.map((r) => {
                const participacion =
                  totales.gastoNeto > 0
                    ? ((r.gasto_neto / totales.gastoNeto) * 100).toFixed(1)
                    : '0.0'
                return (
                  <tr key={r.area_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-sky-400">{r.area_codigo}</td>
                    <td className="px-4 py-3 font-medium text-white">{r.area_nombre}</td>
                    <td className="px-4 py-3 text-slate-400">{r.centro_costo || '-'}</td>
                    <td className="px-4 py-3 text-right text-slate-300 font-mono">
                      {r.cant_despachada.toLocaleString('es-CO')}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-400 font-mono">
                      {r.cant_devuelta > 0 ? r.cant_devuelta.toLocaleString('es-CO') : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">
                      {fmtCOP(r.valor_despachado)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-400">
                      {r.valor_devuelto > 0 ? fmtCOP(r.valor_devuelto) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400 text-sm">
                      {fmtCOP(r.gasto_neto)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-400">
                      {participacion}%
                    </td>
                  </tr>
                )
              })}

              {consumoPorArea.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    No se registran despachos ni consumos en el período seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
            {consumoPorArea.length > 0 && (
              <tfoot className="bg-slate-950 font-bold border-t border-slate-700 text-xs text-white">
                <tr>
                  <td colSpan={3} className="px-4 py-3">TOTALES</td>
                  <td className="px-4 py-3 text-right font-mono">{totales.cantDespachada.toLocaleString('es-CO')}</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-400">{totales.cantDevuelta.toLocaleString('es-CO')}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmtCOP(totales.valorDespachado)}</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-400">{fmtCOP(totales.valorDevuelto)}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-400 text-sm">{fmtCOP(totales.gastoNeto)}</td>
                  <td className="px-4 py-3 text-right font-mono">100%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Tabla: Top Insumos más consumidos */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden p-5 space-y-3">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span>🔝</span>
          <span>Top Insumos con Mayor Consumo en el Período</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Insumo</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Unidad</th>
                <th className="px-4 py-3 text-right">Cant. Neta Consumida</th>
                <th className="px-4 py-3 text-right">Costo Total Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {topInsumos.map((i) => (
                <tr key={i.material_id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-sky-400">{i.material_codigo}</td>
                  <td className="px-4 py-3 font-medium text-white">{i.material_nombre}</td>
                  <td className="px-4 py-3 text-slate-400">{i.categoria}</td>
                  <td className="px-4 py-3 text-slate-400">{i.unidad}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-200">
                    {i.cantidad_neta.toLocaleString('es-CO')}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                    {fmtCOP(i.valor_neto)}
                  </td>
                </tr>
              ))}

              {topInsumos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No hay consumos de insumos registrados en el período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
