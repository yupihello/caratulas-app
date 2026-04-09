/**
 * Caratula Canvas Module
 * Draws the "Caratula de Expediente" directly on an HTML5 Canvas
 * replicating the LaTeX PDF format exactly.
 * No external dependencies.
 */

// ── Design Constants (matching LaTeX geometry: 1.5cm margins on letter) ──
// Letter = 8.5"×11" at 96dpi = 816×1056. Margins 1.5cm ≈ 57px at 96dpi.
const CARTA_W = 816;
const CARTA_H = 1056;
const MARGIN = 57;     // ~1.5cm
const CONTENT_W = CARTA_W - MARGIN * 2; // ~702px

const VERDE = '#1F6E43';

// Conversion: 1cm ≈ 38px at 96dpi
const CM = 38;

const FONT_LABEL = "bold 11px Segoe UI, Arial, sans-serif";
const FONT_VALUE = "bold 11px Segoe UI, Arial, sans-serif";
const FONT_HEADER = "bold 17px Segoe UI, Arial, sans-serif";
const FONT_BARRA = "bold 13px Segoe UI, Arial, sans-serif";
const FONT_TABLE_HEADER = "bold 10px Segoe UI, Arial, sans-serif";
const FONT_TABLE_CELL = "12px Segoe UI, Arial, sans-serif";

const BARRA_H = 24;
const LABEL_COL_W = 4 * CM; // 4cm ~152px
const GAP_AFTER_BARRA = 18;
const GAP_SECTION = 24;
const GAP_TABLE_BARRA = 10;

// ── Helpers ──

function wrapText(ctx, text, maxWidth) {
  if (!text) return [''];
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function drawTableRow(ctx, x, y, cells, widths, h, opts = {}) {
  const { font = FONT_TABLE_CELL, bgColors = [] } = opts;
  let cx = x;
  for (let i = 0; i < cells.length; i++) {
    const w = widths[i];
    if (bgColors[i]) {
      ctx.fillStyle = bgColors[i];
      ctx.fillRect(cx, y, w, h);
    }
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(cx, y, w, h);
    ctx.fillStyle = bgColors[i] === VERDE ? '#fff' : '#000';
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cells[i] || '', cx + w / 2, y + h / 2);
    cx += w;
  }
}

function drawTableHeaderRow(ctx, x, y, headers, widths, h) {
  let cx = x;
  for (let i = 0; i < headers.length; i++) {
    const w = widths[i];
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(cx, y, w, h);
    ctx.fillStyle = '#000';
    ctx.font = FONT_TABLE_HEADER;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const hLines = headers[i].split('\n');
    if (hLines.length > 1) {
      ctx.fillText(hLines[0], cx + w / 2, y + h / 2 - 6);
      ctx.fillText(hLines[1], cx + w / 2, y + h / 2 + 6);
    } else {
      ctx.fillText(hLines[0], cx + w / 2, y + h / 2);
    }
    cx += w;
  }
}

function checkMark(value) {
  return value ? '\u2612' : '\u2610';
}

// ── Section Drawers ──

function setupCanvas(ctx, w, h) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
}

function drawHeader(ctx, logoImg, w) {
  let y = MARGIN + 4;
  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    const logoH = 42;
    const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
    ctx.drawImage(logoImg, MARGIN, y, logoW, logoH);
  }
  const logoColW = 4 * CM;
  const titleAreaX = MARGIN + logoColW;
  const titleAreaW = CONTENT_W - logoColW;
  ctx.font = FONT_HEADER;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CARATULA DE EXPEDIENTE', titleAreaX + titleAreaW / 2, y + 21);
  return y + 50;
}

function drawBarraVerde(ctx, y) {
  ctx.fillStyle = VERDE;
  ctx.fillRect(MARGIN, y, CONTENT_W, BARRA_H);
  return y;
}

function drawBarraVerdeText(ctx, y, text) {
  drawBarraVerde(ctx, y);
  ctx.fillStyle = '#fff';
  ctx.font = FONT_BARRA;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, MARGIN + CONTENT_W / 2, y + BARRA_H / 2);
  return y + BARRA_H;
}

function drawBarraVerdeDoble(ctx, y, t1, t2) {
  const half = CONTENT_W / 2;
  ctx.fillStyle = VERDE;
  ctx.fillRect(MARGIN, y, half, BARRA_H);
  ctx.fillRect(MARGIN + half, y, half, BARRA_H);
  ctx.fillStyle = '#fff';
  ctx.font = FONT_BARRA;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t1, MARGIN + half / 2, y + BARRA_H / 2);
  ctx.fillText(t2, MARGIN + half + half / 2, y + BARRA_H / 2);
  return y + BARRA_H;
}

function drawLabelValueRow(ctx, y, label, value, rowH) {
  const valX = MARGIN + LABEL_COL_W;
  const valW = CONTENT_W - LABEL_COL_W;

  ctx.font = FONT_LABEL;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const labelLines = label.split('\n');
  const labelLineH = 13;
  const labelStartY = y + (rowH - labelLines.length * labelLineH) / 2 + labelLineH / 2;
  for (let i = 0; i < labelLines.length; i++) {
    ctx.fillText(labelLines[i], MARGIN, labelStartY + i * labelLineH);
  }

  ctx.font = FONT_VALUE;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  const lines = wrapText(ctx, value || '', valW - 10);
  const lineH = 14;
  const startY = y + (rowH - lines.length * lineH) / 2 + lineH / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], valX + valW / 2, startY + i * lineH);
  }

  return y + Math.max(rowH, lines.length * lineH + 4);
}

function drawClasificacion(ctx, y, data) {
  y = drawBarraVerdeText(ctx, y, 'CLASIFICACION');
  y += GAP_AFTER_BARRA;
  const rowH = 32;
  const rowH2 = 38;
  y = drawLabelValueRow(ctx, y, 'FONDO', data.FONDO, rowH);
  y = drawLabelValueRow(ctx, y, 'SECCION', data.SECCION, rowH);
  y = drawLabelValueRow(ctx, y, 'SERIE', data.SERIE, rowH);
  y = drawLabelValueRow(ctx, y, 'UNIDAD\nADMINISTRATIVA', data.UNIDAD_ADMINISTRATIVA, rowH2);
  y = drawLabelValueRow(ctx, y, 'AREA\nPRODUCTORA', data.AREA_PRODUCTORA, rowH2);
  y = drawLabelValueRow(ctx, y, 'CLASIFICACION\nARCHIVISTICA', data.CLASIFICACION_ARCHIVISTICA, rowH2);
  return y;
}

function drawDatosExpediente(ctx, y, data) {
  y += GAP_SECTION;
  y = drawBarraVerdeText(ctx, y, 'DATOS DEL EXPEDIENTE');
  y += GAP_AFTER_BARRA;
  const rowH2 = 38;
  y = drawLabelValueRow(ctx, y, 'NOMBRE DEL\nEXPEDIENTE', data.NOMBRE_EXPEDIENTE, rowH2);
  y = drawLabelValueRow(ctx, y, 'ASUNTO DEL\nEXPEDIENTE', data.ASUNTO_EXPEDIENTE, rowH2);
  y += 8;
  const halfW = CONTENT_W / 2;
  const labelW = LABEL_COL_W;
  const dualRowH = 38;

  const midY1 = y + dualRowH / 2;
  ctx.font = FONT_LABEL; ctx.fillStyle = '#000'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('NUMERO DE', MARGIN, midY1 - 6);
  ctx.fillText('LEGAJOS', MARGIN, midY1 + 6);
  ctx.font = FONT_TABLE_CELL; ctx.textAlign = 'center';
  ctx.fillText(data.NUM_LEGAJOS || '', MARGIN + labelW + (halfW - labelW) / 2, midY1);
  ctx.font = FONT_LABEL; ctx.textAlign = 'left';
  ctx.fillText('NUMERO DE', MARGIN + halfW, midY1 - 6);
  ctx.fillText('FOJAS', MARGIN + halfW, midY1 + 6);
  ctx.font = FONT_TABLE_CELL; ctx.textAlign = 'center';
  ctx.fillText(data.NUM_FOJAS || '', MARGIN + halfW + labelW + (halfW - labelW) / 2, midY1);
  y += dualRowH;

  const midY2 = y + dualRowH / 2;
  ctx.font = FONT_LABEL; ctx.fillStyle = '#000'; ctx.textAlign = 'left';
  ctx.fillText('FECHA DE', MARGIN, midY2 - 6);
  ctx.fillText('APERTURA', MARGIN, midY2 + 6);
  ctx.font = FONT_TABLE_CELL; ctx.textAlign = 'center';
  ctx.fillText(data.FECHA_APERTURA || '', MARGIN + labelW + (halfW - labelW) / 2, midY2);
  ctx.font = FONT_LABEL; ctx.textAlign = 'left';
  ctx.fillText('FECHA DE', MARGIN + halfW, midY2 - 6);
  ctx.fillText('CIERRE', MARGIN + halfW, midY2 + 6);
  ctx.font = FONT_TABLE_CELL; ctx.textAlign = 'center';
  ctx.fillText(data.FECHA_CIERRE || '', MARGIN + halfW + labelW + (halfW - labelW) / 2, midY2);
  y += dualRowH;

  return y;
}

function drawTablaValorDocumental(ctx, y, data) {
  y += GAP_SECTION;
  y = drawBarraVerdeDoble(ctx, y, 'VALOR DOCUMENTAL', 'VIGENCIA DOCUMENTAL');
  y += GAP_TABLE_BARRA;
  const ratios = [2.8, 1.4, 1.4, 2, 1.8, 2.8, 1.3];
  const totalR = ratios.reduce((a, b) => a + b, 0);
  const widths = ratios.map(r => (r / totalR) * CONTENT_W);
  const tableX = MARGIN;
  const rh = 32;
  const headers = ['ADMINISTRATIVO', 'LEGAL', 'FISCAL', 'CONTABLE', 'TRAMITE', 'CONCENTRACION', 'TOTAL'];
  drawTableHeaderRow(ctx, tableX, y, headers, widths, rh);
  y += rh;
  const values = [
    checkMark(data.CHECK_ADMINISTRATIVO), checkMark(data.CHECK_LEGAL),
    checkMark(data.CHECK_FISCAL), checkMark(data.CHECK_CONTABLE),
    data.VIGENCIA_TRAMITE || '', data.VIGENCIA_CONCENTRACION || '', data.VIGENCIA_TOTAL || '',
  ];
  drawTableRow(ctx, tableX, y, values, widths, rh, { font: FONT_TABLE_CELL });
  y += rh;
  return y;
}

function drawTablaDestinoFinal(ctx, y, data) {
  y += GAP_SECTION;
  y = drawBarraVerdeDoble(ctx, y, 'DESTINO FINAL', 'ACCESO A LA INFORMACION');
  y += GAP_TABLE_BARRA;
  const ratios = [1.5, 2.8, 2.2, 1.8, 2.2, 2.8];
  const totalR = ratios.reduce((a, b) => a + b, 0);
  const widths = ratios.map(r => (r / totalR) * CONTENT_W);
  const tableX = MARGIN;
  const rh = 32;
  const headers = ['BAJA', 'CONSERVACION', 'MUESTREO', 'PUBLICA', 'RESERVADA', 'CONFIDENCIAL'];
  drawTableHeaderRow(ctx, tableX, y, headers, widths, rh);
  y += rh;
  const values = [
    checkMark(data.CHECK_BAJA), checkMark(data.CHECK_CONSERVACION),
    checkMark(data.CHECK_MUESTREO), checkMark(data.CHECK_PUBLICA),
    checkMark(data.CHECK_RESERVADA), checkMark(data.CHECK_CONFIDENCIAL),
  ];
  drawTableRow(ctx, tableX, y, values, widths, rh, { font: FONT_TABLE_CELL });
  y += rh;
  return y;
}

function drawTablaSoporteDocumental(ctx, y, data) {
  y += GAP_SECTION;
  y = drawBarraVerdeText(ctx, y, 'SOPORTE DOCUMENTAL');
  y += GAP_TABLE_BARRA;
  const ratios = [1.8, 2.6, 1.8, 2.6, 2, 1.6];
  const totalR = ratios.reduce((a, b) => a + b, 0);
  const widths = ratios.map(r => (r / totalR) * CONTENT_W);
  const tableX = MARGIN;
  const rh = 32;
  const headers = ['PAPEL', 'ELECTRONICO', 'PLANO', 'FOTOGRAFIA', 'ESPECIAL', 'OTRA'];
  drawTableHeaderRow(ctx, tableX, y, headers, widths, rh);
  y += rh;
  const values = [
    checkMark(data.CHECK_PAPEL), checkMark(data.CHECK_ELECTRONICO),
    checkMark(data.CHECK_PLANO), checkMark(data.CHECK_FOTOGRAFIA),
    checkMark(data.CHECK_ESPECIAL), checkMark(data.CHECK_OTRA),
  ];
  drawTableRow(ctx, tableX, y, values, widths, rh, { font: FONT_TABLE_CELL });
  y += rh;
  return y;
}

// ── Main Export ──

export function drawCaratula(canvas, data, logoImg, opts = {}) {
  const scale = opts.scale || 1;
  canvas.width = CARTA_W * scale;
  canvas.height = CARTA_H * scale;
  const ctx = canvas.getContext('2d');
  if (scale !== 1) ctx.scale(scale, scale);

  setupCanvas(ctx, CARTA_W, CARTA_H);

  let y = drawHeader(ctx, logoImg, CARTA_W);
  y += 24;
  y = drawClasificacion(ctx, y, data);
  y = drawDatosExpediente(ctx, y, data);
  y = drawTablaValorDocumental(ctx, y, data);
  y = drawTablaDestinoFinal(ctx, y, data);
  y = drawTablaSoporteDocumental(ctx, y, data);
}
