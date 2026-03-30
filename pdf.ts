import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Genera el comprobante de distribución en PDF y lo abre en nueva pestaña.
 * Compatible con jsPDF + jspdf-autotable.
 */
export function generateDistributionPDF(data: {
  distribution: {
    id: string
    fecha: string
    observaciones: string | null
    dni: string
    apellido: string
    nombre: string
    direccion: string | null
    barrio: string | null
    operador: string
  }
  items: Array<{
    name: string
    code: string
    unit: string
    quantity: number
  }>
}) {
  const { distribution: d, items } = data
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const PAGE_W  = 210
  const MARGIN  = 18
  const CONTENT = PAGE_W - MARGIN * 2

  // ── Paleta institucional ───────────────────────────────────────────────────
  const BLUE_DARK  = [12,  43, 103]  as [number,number,number]  // #0c2b67
  const BLUE_MID   = [46,  99, 196]  as [number,number,number]  // #2e63c4
  const GREEN      = [45, 179, 104]  as [number,number,number]  // #2db368
  const GRAY_LIGHT = [240,244,249]   as [number,number,number]  // #f0f4f9
  const GRAY_TEXT  = [100,116,139]   as [number,number,number]  // slate-500

  // ── HEADER ─────────────────────────────────────────────────────────────────
  // Franja azul oscuro
  doc.setFillColor(...BLUE_DARK)
  doc.rect(0, 0, PAGE_W, 28, 'F')

  // Ícono escudo (emoji simulado con texto)
  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  doc.text('🏛', MARGIN, 17)

  // Título institucional
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('MUNICIPALIDAD DE SAN ROQUE', MARGIN + 12, 11)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 205, 240)
  doc.text('Dirección de Acción Social  ·  Sistema de Gestión de Stock', MARGIN + 12, 17)

  // Número de comprobante alineado derecha
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  const shortId = d.id.slice(0, 8).toUpperCase()
  doc.text(`Comp. N° ${shortId}`, PAGE_W - MARGIN, 11, { align: 'right' })
  doc.text(
    format(new Date(d.fecha), "dd/MM/yyyy HH:mm", { locale: es }),
    PAGE_W - MARGIN, 17, { align: 'right' }
  )

  // Franja de subtítulo azul medio
  doc.setFillColor(...BLUE_MID)
  doc.rect(0, 28, PAGE_W, 9, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('COMPROBANTE DE DISTRIBUCIÓN DE MERCADERÍA', PAGE_W / 2, 34, { align: 'center' })

  let y = 46

  // ── DATOS DEL BENEFICIARIO ─────────────────────────────────────────────────
  doc.setFillColor(...GRAY_LIGHT)
  doc.roundedRect(MARGIN, y, CONTENT, 26, 2, 2, 'F')

  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLUE_DARK)
  doc.text('DATOS DEL BENEFICIARIO', MARGIN + 4, y + 5)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`${d.apellido}, ${d.nombre}`, MARGIN + 4, y + 12)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY_TEXT)
  const infoLine = [
    `DNI: ${d.dni}`,
    d.barrio    ? `Barrio: ${d.barrio}`        : null,
    d.direccion ? `Dir: ${d.direccion}`        : null,
  ].filter(Boolean).join('   ·   ')
  doc.text(infoLine, MARGIN + 4, y + 19)

  y += 34

  // ── TABLA DE ARTÍCULOS ─────────────────────────────────────────────────────
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLUE_DARK)
  doc.text('ARTÍCULOS ENTREGADOS', MARGIN, y)
  y += 3

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Código', 'Descripción del Artículo', 'Unidad', 'Cantidad']],
    body: items.map(i => [i.code, i.name, i.unit, String(i.quantity)]),
    styles: {
      fontSize: 9,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      font: 'helvetica',
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: BLUE_DARK,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: GRAY_LIGHT,
    },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold', textColor: BLUE_MID },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
    },
  })

  y = (doc as any).lastAutoTable.finalY + 8

  // ── OBSERVACIONES ──────────────────────────────────────────────────────────
  if (d.observaciones) {
    doc.setFillColor(255, 251, 235) // amber-50
    doc.roundedRect(MARGIN, y, CONTENT, 12, 2, 2, 'F')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(146, 64, 14) // amber-800
    doc.text('OBSERVACIONES: ', MARGIN + 4, y + 5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(d.observaciones, MARGIN + 36, y + 5)
    y += 18
  }

  // ── FIRMAS ─────────────────────────────────────────────────────────────────
  y = Math.max(y, 200)

  // Línea de firma beneficiario
  doc.setDrawColor(...BLUE_MID)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y + 12, MARGIN + 70, y + 12)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY_TEXT)
  doc.text('Firma y aclaración del Beneficiario', MARGIN, y + 17)
  doc.text(`DNI: ${d.dni}`, MARGIN, y + 22)

  // Línea de firma operador
  doc.line(PAGE_W - MARGIN - 70, y + 12, PAGE_W - MARGIN, y + 12)
  doc.text('Firma del Agente Municipal', PAGE_W - MARGIN - 70, y + 17)
  doc.text(d.operador, PAGE_W - MARGIN - 70, y + 22)

  y += 32

  // ── SELLO DE ACLARACIÓN LEGAL ──────────────────────────────────────────────
  doc.setFillColor(240, 244, 249)
  doc.rect(MARGIN, y, CONTENT, 10, 'F')
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(148, 163, 184)
  doc.text(
    'Este comprobante certifica la recepción conforme de los artículos detallados. ' +
    'Emitido por el Sistema de Gestión de Stock - Municipalidad de San Roque.',
    MARGIN + 4, y + 4
  )
  doc.text(
    `Operador: ${d.operador}   ·   Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}   ·   ID: ${d.id}`,
    MARGIN + 4, y + 8
  )

  // ── FOOTER ─────────────────────────────────────────────────────────────────
  doc.setFillColor(...GREEN)
  doc.rect(0, 287, PAGE_W, 10, 'F')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(255, 255, 255)
  doc.text(
    'Municipalidad de San Roque  ·  munisanroque.ar  ·  Acción Social',
    PAGE_W / 2, 293, { align: 'center' }
  )

  // ── Abrir en nueva pestaña ─────────────────────────────────────────────────
  doc.output('dataurlnewwindow', {
    filename: `comprobante_distribucion_${d.dni}_${format(new Date(d.fecha), 'yyyyMMdd')}.pdf`
  })
}
