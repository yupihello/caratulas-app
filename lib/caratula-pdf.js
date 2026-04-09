const { readFileSync } = require('fs');

/**
 * Genera un PDF de caratula usando PDFKit.
 * Adaptado de ide-next/lib/server/db-handlers.js generateCaratulaPdf
 * @param {Object} data - Campos de la caratula
 * @param {string} logoPath - Ruta al logo PNG
 * @returns {Promise<Buffer>} PDF como buffer
 */
async function generateCaratulaPdf(data, logoPath) {
  const PDFDocument = require('pdfkit');

  function streamToBuffer(doc) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }

  function drawCheckbox(doc, x, y, checked, size = 10) {
    doc.rect(x, y, size, size).stroke();
    if (checked) {
      doc.moveTo(x + 2, y + 2).lineTo(x + size - 2, y + size - 2).stroke();
      doc.moveTo(x + size - 2, y + 2).lineTo(x + 2, y + size - 2).stroke();
    }
  }

  function drawTableRow(doc, x, y, cells, colWidths, rowHeight, opts = {}) {
    const { headerBg, fontSize = 7, bold = false, align = 'center' } = opts;
    let cx = x;
    for (let i = 0; i < cells.length; i++) {
      const w = colWidths[i];
      if (headerBg) doc.save().rect(cx, y, w, rowHeight).fill(headerBg).restore();
      doc.rect(cx, y, w, rowHeight).stroke();
      doc.fontSize(fontSize);
      if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
      doc.text(cells[i] || '', cx + 2, y + (rowHeight - fontSize) / 2, {
        width: w - 4, align, lineBreak: false,
      });
      cx += w;
    }
  }

  function drawCheckboxRow(doc, x, y, checks, colWidths, rowHeight) {
    let cx = x;
    for (let i = 0; i < checks.length; i++) {
      const w = colWidths[i];
      doc.rect(cx, y, w, rowHeight).stroke();
      if (typeof checks[i] === 'boolean') {
        drawCheckbox(doc, cx + (w - 10) / 2, y + (rowHeight - 10) / 2, checks[i]);
      } else {
        doc.font('Helvetica').fontSize(9);
        doc.text(String(checks[i] || ''), cx + 2, y + (rowHeight - 9) / 2, {
          width: w - 4, align: 'center', lineBreak: false,
        });
      }
      cx += w;
    }
  }

  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 56, bottom: 56, left: 56, right: 56 } });
  const bufferPromise = streamToBuffer(doc);
  const pageWidth = 612 - 56 * 2;

  try { doc.image(readFileSync(logoPath), (612 - 120) / 2, 56, { width: 120 }); } catch {}
  doc.moveDown(3);

  doc.y += 10;
  doc.font('Helvetica-Bold').fontSize(14).text('CLASIFICACION', { align: 'center' });
  doc.moveDown(0.5);

  const labelWidth = 175;
  const valueWidth = pageWidth - labelWidth;
  const fields = [
    ['FONDO:', data.FONDO], ['SECCION:', data.SECCION], ['SERIE:', data.SERIE],
    ['UNIDAD ADMINISTRATIVA:', data.UNIDAD_ADMINISTRATIVA],
    ['AREA PRODUCTORA:', data.AREA_PRODUCTORA],
    ['CLASIFICACION ARCHIVISTICA:', data.CLASIFICACION_ARCHIVISTICA],
  ];

  for (const [label, value] of fields) {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).text(label, 56, y, { width: labelWidth });
    doc.font('Helvetica').fontSize(9).text(value || '', 56 + labelWidth, y, { width: valueWidth });
    doc.y = Math.max(doc.y, y + 14);
  }

  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(14).text('DATOS DEL EXPEDIENTE', { align: 'center' });
  doc.moveDown(0.5);

  for (const [label, value] of [['NOMBRE DEL EXPEDIENTE:', data.NOMBRE_EXPEDIENTE], ['ASUNTO DEL EXPEDIENTE:', data.ASUNTO_EXPEDIENTE]]) {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).text(label, 56, y, { width: labelWidth });
    doc.font('Helvetica').fontSize(9).text(value || '', 56 + labelWidth, y, { width: valueWidth });
    doc.y = Math.max(doc.y, y + 14);
  }

  doc.moveDown(0.3);
  const halfWidth = pageWidth / 2;
  let y = doc.y;

  doc.font('Helvetica-Bold').fontSize(9).text('NUM. LEGAJOS:', 56, y, { width: 100 });
  doc.font('Helvetica').fontSize(9).text(data.NUM_LEGAJOS || '', 156, y, { width: halfWidth - 100 });
  doc.font('Helvetica-Bold').fontSize(9).text('NUM. FOJAS:', 56 + halfWidth, y, { width: 100 });
  doc.font('Helvetica').fontSize(9).text(data.NUM_FOJAS || '', 56 + halfWidth + 100, y, { width: halfWidth - 100 });
  doc.y = y + 16;

  y = doc.y;
  doc.font('Helvetica-Bold').fontSize(9).text('FECHA APERTURA:', 56, y, { width: 110 });
  doc.font('Helvetica').fontSize(9).text(data.FECHA_APERTURA || '', 166, y, { width: halfWidth - 110 });
  doc.font('Helvetica-Bold').fontSize(9).text('FECHA CIERRE:', 56 + halfWidth, y, { width: 100 });
  doc.font('Helvetica').fontSize(9).text(data.FECHA_CIERRE || '', 56 + halfWidth + 100, y, { width: halfWidth - 100 });
  doc.y = y + 16;
  doc.moveDown(0.8);

  const rowH = 20;

  // Valor Documental
  doc.font('Helvetica-Bold').fontSize(10).text('VALOR DOCUMENTAL / VIGENCIA DOCUMENTAL', { align: 'center' });
  doc.moveDown(0.4);
  const valHeaders = ['ADMINISTRATIVO', 'LEGAL', 'FISCAL', 'CONTABLE', 'TRAMITE', 'CONCENTRACION', 'TOTAL'];
  const valWidths = [80, 62, 62, 68, 62, 85, 62];
  const tableX = 56 + (pageWidth - valWidths.reduce((a, b) => a + b, 0)) / 2;
  y = doc.y;
  drawTableRow(doc, tableX, y, valHeaders, valWidths, rowH, { headerBg: '#f0f0f0', fontSize: 6.5, bold: true });
  y += rowH;
  drawCheckboxRow(doc, tableX, y, [
    data.CHECK_ADMINISTRATIVO || false, data.CHECK_LEGAL || false,
    data.CHECK_FISCAL || false, data.CHECK_CONTABLE || false,
    data.VIGENCIA_TRAMITE || '', data.VIGENCIA_CONCENTRACION || '', data.VIGENCIA_TOTAL || '',
  ], valWidths, rowH);
  doc.y = y + rowH;
  doc.moveDown(0.8);

  // Destino Final
  doc.font('Helvetica-Bold').fontSize(10).text('DESTINO FINAL / ACCESO A LA INFORMACION', { align: 'center' });
  doc.moveDown(0.4);
  const destHeaders = ['BAJA', 'CONSERVACION', 'MUESTREO', 'PUBLICA', 'RESERVADA', 'CONFIDENCIAL'];
  const destWidths = [70, 85, 75, 75, 75, 85];
  const destX = 56 + (pageWidth - destWidths.reduce((a, b) => a + b, 0)) / 2;
  y = doc.y;
  drawTableRow(doc, destX, y, destHeaders, destWidths, rowH, { headerBg: '#f0f0f0', fontSize: 7, bold: true });
  y += rowH;
  drawCheckboxRow(doc, destX, y, [
    data.CHECK_BAJA || false, data.CHECK_CONSERVACION || false, data.CHECK_MUESTREO || false,
    data.CHECK_PUBLICA || false, data.CHECK_RESERVADA || false, data.CHECK_CONFIDENCIAL || false,
  ], destWidths, rowH);
  doc.y = y + rowH;
  doc.moveDown(0.8);

  // Soporte Documental
  doc.font('Helvetica-Bold').fontSize(10).text('SOPORTE DOCUMENTAL', { align: 'center' });
  doc.moveDown(0.4);
  const sopHeaders = ['PAPEL', 'ELECTRONICO', 'PLANO', 'FOTOGRAFIA', 'ESPECIAL', 'OTRA'];
  const sopWidths = [70, 85, 70, 85, 75, 70];
  const sopX = 56 + (pageWidth - sopWidths.reduce((a, b) => a + b, 0)) / 2;
  y = doc.y;
  drawTableRow(doc, sopX, y, sopHeaders, sopWidths, rowH, { headerBg: '#f0f0f0', fontSize: 7, bold: true });
  y += rowH;
  drawCheckboxRow(doc, sopX, y, [
    data.CHECK_PAPEL || false, data.CHECK_ELECTRONICO || false, data.CHECK_PLANO || false,
    data.CHECK_FOTOGRAFIA || false, data.CHECK_ESPECIAL || false, data.CHECK_OTRA || false,
  ], sopWidths, rowH);

  doc.end();
  return await bufferPromise;
}

/**
 * Genera un PDF multi-pagina (una caratula por pagina).
 * @param {Object[]} dataArray - Array de datos de caratula
 * @param {string} logoPath - Ruta al logo PNG
 * @returns {Promise<Buffer>}
 */
async function generateMultiCaratulaPdf(dataArray, logoPath) {
  const PDFDocument = require('pdfkit');

  function streamToBuffer(doc) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }

  function drawCheckbox(doc, x, y, checked, size = 10) {
    doc.rect(x, y, size, size).stroke();
    if (checked) {
      doc.moveTo(x + 2, y + 2).lineTo(x + size - 2, y + size - 2).stroke();
      doc.moveTo(x + size - 2, y + 2).lineTo(x + 2, y + size - 2).stroke();
    }
  }

  function drawTableRow(doc, x, y, cells, colWidths, rowHeight, opts = {}) {
    const { headerBg, fontSize = 7, bold = false, align = 'center' } = opts;
    let cx = x;
    for (let i = 0; i < cells.length; i++) {
      const w = colWidths[i];
      if (headerBg) doc.save().rect(cx, y, w, rowHeight).fill(headerBg).restore();
      doc.rect(cx, y, w, rowHeight).stroke();
      doc.fontSize(fontSize);
      if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
      doc.text(cells[i] || '', cx + 2, y + (rowHeight - fontSize) / 2, {
        width: w - 4, align, lineBreak: false,
      });
      cx += w;
    }
  }

  function drawCheckboxRow(doc, x, y, checks, colWidths, rowHeight) {
    let cx = x;
    for (let i = 0; i < checks.length; i++) {
      const w = colWidths[i];
      doc.rect(cx, y, w, rowHeight).stroke();
      if (typeof checks[i] === 'boolean') {
        drawCheckbox(doc, cx + (w - 10) / 2, y + (rowHeight - 10) / 2, checks[i]);
      } else {
        doc.font('Helvetica').fontSize(9);
        doc.text(String(checks[i] || ''), cx + 2, y + (rowHeight - 9) / 2, {
          width: w - 4, align: 'center', lineBreak: false,
        });
      }
      cx += w;
    }
  }

  function renderPage(doc, data, logoBuffer, pageWidth) {
    try { doc.image(logoBuffer, (612 - 120) / 2, 56, { width: 120 }); } catch {}
    doc.moveDown(3);
    doc.y += 10;
    doc.font('Helvetica-Bold').fontSize(14).text('CLASIFICACION', { align: 'center' });
    doc.moveDown(0.5);

    const labelWidth = 175;
    const valueWidth = pageWidth - labelWidth;
    const fields = [
      ['FONDO:', data.FONDO], ['SECCION:', data.SECCION], ['SERIE:', data.SERIE],
      ['UNIDAD ADMINISTRATIVA:', data.UNIDAD_ADMINISTRATIVA],
      ['AREA PRODUCTORA:', data.AREA_PRODUCTORA],
      ['CLASIFICACION ARCHIVISTICA:', data.CLASIFICACION_ARCHIVISTICA],
    ];
    for (const [label, value] of fields) {
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(9).text(label, 56, y, { width: labelWidth });
      doc.font('Helvetica').fontSize(9).text(value || '', 56 + labelWidth, y, { width: valueWidth });
      doc.y = Math.max(doc.y, y + 14);
    }

    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(14).text('DATOS DEL EXPEDIENTE', { align: 'center' });
    doc.moveDown(0.5);
    for (const [label, value] of [['NOMBRE DEL EXPEDIENTE:', data.NOMBRE_EXPEDIENTE], ['ASUNTO DEL EXPEDIENTE:', data.ASUNTO_EXPEDIENTE]]) {
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(9).text(label, 56, y, { width: labelWidth });
      doc.font('Helvetica').fontSize(9).text(value || '', 56 + labelWidth, y, { width: valueWidth });
      doc.y = Math.max(doc.y, y + 14);
    }

    doc.moveDown(0.3);
    const halfWidth = pageWidth / 2;
    let y = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).text('NUM. LEGAJOS:', 56, y, { width: 100 });
    doc.font('Helvetica').fontSize(9).text(data.NUM_LEGAJOS || '', 156, y, { width: halfWidth - 100 });
    doc.font('Helvetica-Bold').fontSize(9).text('NUM. FOJAS:', 56 + halfWidth, y, { width: 100 });
    doc.font('Helvetica').fontSize(9).text(data.NUM_FOJAS || '', 56 + halfWidth + 100, y, { width: halfWidth - 100 });
    doc.y = y + 16;

    y = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).text('FECHA APERTURA:', 56, y, { width: 110 });
    doc.font('Helvetica').fontSize(9).text(data.FECHA_APERTURA || '', 166, y, { width: halfWidth - 110 });
    doc.font('Helvetica-Bold').fontSize(9).text('FECHA CIERRE:', 56 + halfWidth, y, { width: 100 });
    doc.font('Helvetica').fontSize(9).text(data.FECHA_CIERRE || '', 56 + halfWidth + 100, y, { width: halfWidth - 100 });
    doc.y = y + 16;
    doc.moveDown(0.8);

    const rowH = 20;
    // Valor Documental
    doc.font('Helvetica-Bold').fontSize(10).text('VALOR DOCUMENTAL / VIGENCIA DOCUMENTAL', { align: 'center' });
    doc.moveDown(0.4);
    const valHeaders = ['ADMINISTRATIVO', 'LEGAL', 'FISCAL', 'CONTABLE', 'TRAMITE', 'CONCENTRACION', 'TOTAL'];
    const valWidths = [80, 62, 62, 68, 62, 85, 62];
    const tableX = 56 + (pageWidth - valWidths.reduce((a, b) => a + b, 0)) / 2;
    y = doc.y;
    drawTableRow(doc, tableX, y, valHeaders, valWidths, rowH, { headerBg: '#f0f0f0', fontSize: 6.5, bold: true });
    y += rowH;
    drawCheckboxRow(doc, tableX, y, [
      data.CHECK_ADMINISTRATIVO || false, data.CHECK_LEGAL || false,
      data.CHECK_FISCAL || false, data.CHECK_CONTABLE || false,
      data.VIGENCIA_TRAMITE || '', data.VIGENCIA_CONCENTRACION || '', data.VIGENCIA_TOTAL || '',
    ], valWidths, rowH);
    doc.y = y + rowH;
    doc.moveDown(0.8);

    // Destino Final
    doc.font('Helvetica-Bold').fontSize(10).text('DESTINO FINAL / ACCESO A LA INFORMACION', { align: 'center' });
    doc.moveDown(0.4);
    const destHeaders = ['BAJA', 'CONSERVACION', 'MUESTREO', 'PUBLICA', 'RESERVADA', 'CONFIDENCIAL'];
    const destWidths = [70, 85, 75, 75, 75, 85];
    const destX = 56 + (pageWidth - destWidths.reduce((a, b) => a + b, 0)) / 2;
    y = doc.y;
    drawTableRow(doc, destX, y, destHeaders, destWidths, rowH, { headerBg: '#f0f0f0', fontSize: 7, bold: true });
    y += rowH;
    drawCheckboxRow(doc, destX, y, [
      data.CHECK_BAJA || false, data.CHECK_CONSERVACION || false, data.CHECK_MUESTREO || false,
      data.CHECK_PUBLICA || false, data.CHECK_RESERVADA || false, data.CHECK_CONFIDENCIAL || false,
    ], destWidths, rowH);
    doc.y = y + rowH;
    doc.moveDown(0.8);

    // Soporte Documental
    doc.font('Helvetica-Bold').fontSize(10).text('SOPORTE DOCUMENTAL', { align: 'center' });
    doc.moveDown(0.4);
    const sopHeaders = ['PAPEL', 'ELECTRONICO', 'PLANO', 'FOTOGRAFIA', 'ESPECIAL', 'OTRA'];
    const sopWidths = [70, 85, 70, 85, 75, 70];
    const sopX = 56 + (pageWidth - sopWidths.reduce((a, b) => a + b, 0)) / 2;
    y = doc.y;
    drawTableRow(doc, sopX, y, sopHeaders, sopWidths, rowH, { headerBg: '#f0f0f0', fontSize: 7, bold: true });
    y += rowH;
    drawCheckboxRow(doc, sopX, y, [
      data.CHECK_PAPEL || false, data.CHECK_ELECTRONICO || false, data.CHECK_PLANO || false,
      data.CHECK_FOTOGRAFIA || false, data.CHECK_ESPECIAL || false, data.CHECK_OTRA || false,
    ], sopWidths, rowH);
  }

  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 56, bottom: 56, left: 56, right: 56 } });
  const bufferPromise = streamToBuffer(doc);
  const pageWidth = 612 - 56 * 2;

  let logoBuffer;
  try { logoBuffer = readFileSync(logoPath); } catch { logoBuffer = null; }

  for (let i = 0; i < dataArray.length; i++) {
    if (i > 0) doc.addPage();
    renderPage(doc, dataArray[i], logoBuffer, pageWidth);
  }

  doc.end();
  return await bufferPromise;
}

module.exports = { generateCaratulaPdf, generateMultiCaratulaPdf };
