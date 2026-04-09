const XLSX = require('xlsx');

/**
 * Convierte un serial de fecha Excel/ODS a string YYYY-MM-DD.
 * Si ya es string lo retorna tal cual.
 */
function excelDateToStr(val) {
  if (val == null) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') {
    // Excel serial date → JS Date
    const d = new Date((val - 25569) * 86400 * 1000);
    if (isNaN(d.getTime())) return String(val);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yy = d.getUTCFullYear();
    return `${dd}/${mm}/${yy}`;
  }
  return String(val);
}

/**
 * Parsea una hoja ODS con headers en la fila 0.
 * Retorna array de objetos { col: valor }.
 */
function parseSheet(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

/**
 * Parsea una hoja ODS usando raw headers (fila 0 como array).
 * Retorna array de objetos con headers como keys.
 */
function parseSheetRaw(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
  if (rows.length < 2) return [];
  const headers = rows[0].map((h, i) => (h ? String(h).trim() : `col_${i}`));
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] != null ? row[i] : ''; });
    return obj;
  });
}

/**
 * Extrae tipo de bitacora: "15/DK-0001/01/26" → "DK"
 */
function extractTipo(bitacora) {
  if (!bitacora) return '';
  const m = String(bitacora).match(/^\d+\/([A-Z0-9]+)-/i);
  return m ? m[1].toUpperCase() : '';
}

const ASUNTO_MAP = {
  'DK': 'REEMBARQUES FORESTALES (DJ-DK)',
  'DJ': 'REEMBARQUES FORESTALES (DJ-DK)',
  'G1': 'AUTORIZACIONES DE APROVECHAMIENTO FORESTAL MADERABLE',
  'G3': 'AUTORIZACIONES DE APROVECHAMIENTO DE RECURSOS FORESTALES NO MADERABLES',
};

/**
 * Lee el archivo "CARATULA NUEVA DE EXPEDIENTES".
 * Hojas principales: "DK-DJ 2023-2024" y "G1-G3 2023-2024"
 * Columnas: BITACORA, TITULAR, MUNICIPIO, REGION, NO. OF., FECHA DE INGRESO,
 *           AÑO, FECHA DE APERTURA 2024, FECHA DE APERTURA 2023, NO. LEGAJOS, NO. FOJAS
 */
function readCaratulaOds(filePath) {
  const wb = XLSX.readFile(filePath);
  const registros = [];

  // Parsear hojas de datos (DK-DJ y G1-G3)
  const dataSheets = wb.SheetNames.filter(n =>
    /DK|DJ|G1|G3/i.test(n) && !/CARAT|INVENTARIO/i.test(n)
  );

  for (const sheetName of dataSheets) {
    const rows = parseSheetRaw(wb, sheetName);
    for (const row of rows) {
      const bitacora = String(row['BITACORA'] || row['BITÁCORA'] || '').trim();
      if (!bitacora || !/^\d+\//.test(bitacora)) continue;

      const tipo = extractTipo(bitacora);
      const year = String(row['AÑO'] || '').trim();

      // Determinar fecha de apertura
      let fechaApertura = '';
      if (row['FECHA DE APERTURA 2024']) fechaApertura = excelDateToStr(row['FECHA DE APERTURA 2024']);
      if ((!fechaApertura || fechaApertura === 'N/A') && row['FECHA DE APERTURA 2023']) {
        fechaApertura = excelDateToStr(row['FECHA DE APERTURA 2023']);
      }
      if (fechaApertura === 'N/A') fechaApertura = '';

      // Parsear legajos y fojas (pueden ser rangos como "1-6", "1-15")
      const legajosRaw = String(row['NO. LEGAJOS'] || '1').trim();
      const fojasRaw = String(row['NO. FOJAS'] || '').trim();

      registros.push({
        bitacora,
        tipo,
        titular: String(row['TITULAR'] || '').trim(),
        municipio: String(row['MUNICIPIO'] || '').trim(),
        region: String(row['REGION'] || row['   '] || '').trim(),
        asunto: ASUNTO_MAP[tipo] || '',
        fechaIngreso: excelDateToStr(row['FECHA DE INGRESO']),
        fechaApertura,
        year,
        numLegajos: legajosRaw,
        numFojas: fojasRaw,
        numCaja: String(row['NO. DE CAJA'] || '').trim(),
        fuente: 'caratula',
        hoja: sheetName,
      });
    }
  }

  return { registros, hojas: wb.SheetNames };
}

/**
 * Lee el archivo "BASE BRENDA 2026".
 * Hojas principales: "2026 DK-DJ - G1-G3" (datos principales)
 *                    "ENERO INVENTARIO...", "FEBRERO INVENTARIO" (inventarios con fojas)
 * Columnas 2026: BITÁCORA, NOMBRE TITULAR COMUNAL y/o TECNICO, Municipio,
 *                Fecha de apertura, Asunto, fecha de entrega a la Unidad
 * Columnas inventario: BITACORA, NOMBRE TITULAR COMUNAL, FECHA APERTURA,
 *                      FECHA CIERRE BIT., NUMERO DE FOJAS, NO. CAJA, LEGAJOS
 */
function readBrendaOds(filePath) {
  const wb = XLSX.readFile(filePath);
  const registros = [];
  const inventario = {};

  // 1. Parsear inventarios mensuales primero (tienen fojas, legajos, fecha cierre)
  const invSheets = wb.SheetNames.filter(n => /INVENTARIO/i.test(n));
  for (const sheetName of invSheets) {
    const rows = parseSheetRaw(wb, sheetName);
    for (const row of rows) {
      const bitacora = String(row['BITACORA'] || row['BITÁCORA'] || '').trim();
      if (!bitacora || !/^\d+\//.test(bitacora)) continue;
      inventario[bitacora] = {
        numFojas: String(row['NUMERO DE FOJAS'] || '').trim(),
        numCaja: String(row['NO. CAJA'] || '').trim(),
        numLegajos: String(row['LEGAJOS'] || row['NO. LEGAJOS'] || '').trim(),
        fechaCierre: excelDateToStr(row['FECHA CIERRE BIT.'] || row['FECHA CIERRE']),
        fechaApertura: excelDateToStr(row['FECHA  APERTURA'] || row['FECHA APERTURA']),
        clasificacion: String(row['CLASIFICACION ARCHIVISTICA'] || '').trim(),
      };
    }
  }

  // 2. Parsear hoja principal "2026 DK-DJ - G1-G3"
  const mainSheet = wb.SheetNames.find(n => /2026.*DK|DK.*2026/i.test(n));
  if (mainSheet) {
    const rows = parseSheetRaw(wb, mainSheet);
    for (const row of rows) {
      const bitacora = String(row['BITÁCORA'] || row['BITACORA'] || '').trim();
      if (!bitacora || !/^\d+\//.test(bitacora)) continue;

      const tipo = extractTipo(bitacora);
      const inv = inventario[bitacora] || {};

      registros.push({
        bitacora,
        tipo,
        titular: String(row['NOMBRE TITULAR COMUNAL  y/o TECNICO'] || row['NOMBRE TITULAR COMUNAL'] || '').trim(),
        municipio: String(row['Municipio'] || row['MUNICIPIO'] || '').trim(),
        region: String(row['   '] || '').trim(),
        asunto: ASUNTO_MAP[tipo] || String(row['Asunto'] || '').trim(),
        fechaEntregaUnidad: excelDateToStr(row['fecha de entrega a la Unidad']),
        fechaApertura: excelDateToStr(row['Fecha de apertura']) || inv.fechaApertura || '',
        fechaCierre: inv.fechaCierre || '',
        numFojas: inv.numFojas || '',
        numLegajos: inv.numLegajos || '1',
        numCaja: inv.numCaja || '',
        clasificacion: inv.clasificacion || '',
        fuente: 'brenda',
        hoja: mainSheet,
      });
    }
  }

  // 3. Agregar registros de inventario que no esten en la hoja principal
  for (const [bitacora, inv] of Object.entries(inventario)) {
    if (registros.some(r => r.bitacora === bitacora)) continue;
    const tipo = extractTipo(bitacora);
    registros.push({
      bitacora,
      tipo,
      titular: '',
      municipio: '',
      region: '',
      asunto: ASUNTO_MAP[tipo] || '',
      fechaEntregaUnidad: '',
      fechaApertura: inv.fechaApertura || '',
      fechaCierre: inv.fechaCierre || '',
      numFojas: inv.numFojas || '',
      numLegajos: inv.numLegajos || '1',
      numCaja: inv.numCaja || '',
      clasificacion: inv.clasificacion || '',
      fuente: 'brenda-inventario',
      hoja: 'inventario',
    });
  }

  return { registros, hojas: wb.SheetNames };
}

module.exports = { readCaratulaOds, readBrendaOds };
