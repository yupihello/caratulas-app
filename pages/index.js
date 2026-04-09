import { useState, useEffect, useCallback, useRef } from 'react';
import { drawCaratula } from '../lib/caratula-canvas';
import TopBar from '../components/views/TopBar';
import SearchView from '../components/views/SearchView';
import FilterResultsView from '../components/views/FilterResultsView';
import EditorView from '../components/views/EditorView';
import styles from '../styles/caratula.module.css';

const CARATULA_DEFAULTS = {
  FONDO: 'SECRETARIA DE MEDIO AMBIENTE Y RECURSOS NATURALES',
  SECCION: '5S EVALUACION DE LA GESTION FORESTAL Y DE SUELOS',
  SERIE: '5S.8 PROCEDENCIA DE LAS MATERIAS PRIMAS FORESTALES',
  UNIDAD_ADMINISTRATIVA: 'OFICINA DE REPRESENTACION EN EL ESTADO DE MEXICO',
  AREA_PRODUCTORA: 'UNIDAD DE APROVECHAMIENTO Y RESTAURACION DE RECURSOS FORESTALES',
  CLASIFICACION_ARCHIVISTICA: 'SEMARNAT.5S.8',
  CHECK_ADMINISTRATIVO: true, CHECK_LEGAL: false, CHECK_FISCAL: false, CHECK_CONTABLE: false,
  VIGENCIA_TRAMITE: '2', VIGENCIA_CONCENTRACION: '5', VIGENCIA_TOTAL: '7',
  CHECK_BAJA: false, CHECK_CONSERVACION: false, CHECK_MUESTREO: true,
  CHECK_PUBLICA: false, CHECK_RESERVADA: false, CHECK_CONFIDENCIAL: false,
  CHECK_PAPEL: true, CHECK_ELECTRONICO: false, CHECK_PLANO: false,
  CHECK_FOTOGRAFIA: false, CHECK_ESPECIAL: false, CHECK_OTRA: false,
};

const CARATULA_ASUNTO_MAP = {
  'DK': 'REEMBARQUES FORESTALES (DJ-DK)',
  'DJ': 'REEMBARQUES FORESTALES (DJ-DK)',
  'G1': 'AUTORIZACIONES DE APROVECHAMIENTO FORESTAL MADERABLE',
  'G3': 'AUTORIZACIONES DE APROVECHAMIENTO DE RECURSOS FORESTALES NO MADERABLES',
};

function extractTipo(b) {
  const m = String(b).match(/^\d+\/([A-Z0-9]+)-/i);
  return m ? m[1].toUpperCase() : '';
}

function buildCaratulaData(reg) {
  const tipo = extractTipo(reg.bitacora);
  return {
    ...CARATULA_DEFAULTS,
    NOMBRE_EXPEDIENTE: [reg.titular, reg.municipio].filter(Boolean).join(' - '),
    ASUNTO_EXPEDIENTE: CARATULA_ASUNTO_MAP[tipo] || reg.asunto || '',
    NUM_LEGAJOS: reg.numLegajos || '1',
    NUM_FOJAS: reg.numFojas || '',
    FECHA_APERTURA: reg.fechaEntregaUnidad || reg.fechaApertura || '',
    FECHA_CIERRE: reg.fechaCierre || '',
    _bitacora: reg.bitacora,
  };
}

function Toast({ message, type, visible }) {
  const cls = [styles.toast, type === 'error' ? styles.toastError : styles.toastSuccess, !visible && styles.toastHidden].filter(Boolean).join(' ');
  return <div className={cls}>{message}</div>;
}

export default function CaratulaPage() {
  const [registros, setRegistros] = useState([]);
  const [files, setFiles] = useState({ caratula: null, brenda: null });
  const [loading, setLoading] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success', visible: false });
  const [appVersion, setAppVersion] = useState('');

  const [modo, setModo] = useState('buscar');
  const [filtrados, setFiltrados] = useState([]);
  const [data, setData] = useState({ ...CARATULA_DEFAULTS, NOMBRE_EXPEDIENTE: '', ASUNTO_EXPEDIENTE: '', NUM_LEGAJOS: '1', NUM_FOJAS: '', FECHA_APERTURA: '', FECHA_CIERRE: '' });
  const [bitacora, setBitacora] = useState('');
  const [batchQueue, setBatchQueue] = useState([]);
  const [batchIndex, setBatchIndex] = useState(-1);
  const editorRef = useRef(null);

  const showSuccess = useCallback((msg) => {
    setToast({ message: msg, type: 'success', visible: true });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  }, []);
  const showError = useCallback((msg) => {
    setToast({ message: msg, type: 'error', visible: true });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  }, []);

  // Init: load version + saved ODS files
  useEffect(() => {
    fetch('/api/version').then(r => r.json()).then(d => setAppVersion(d.version)).catch(() => {});
    (async () => {
      try {
        const res = await fetch('/api/settings');
        const settings = await res.json();
        const all = [];
        for (const [tipo, key] of [['caratula', 'caratulaOdsPath'], ['brenda', 'brendaOdsPath']]) {
          if (!settings[key]) continue;
          try {
            const r = await fetch('/api/read-ods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath: settings[key], tipo }) });
            const result = await r.json();
            if (result.registros) {
              all.push(...result.registros);
              setFiles(f => ({ ...f, [tipo]: { path: settings[key], count: result.registros.length } }));
            }
          } catch {}
        }
        if (all.length > 0) setRegistros(all);
      } catch {}
    })();
  }, []);

  // File loading
  const loadOdsFile = useCallback(async (tipo) => {
    const dlgRes = await fetch('/api/open-file-dialog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo }) });
    const { filePath } = await dlgRes.json();
    if (!filePath) return;
    setLoading(true);
    try {
      const res = await fetch('/api/read-ods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath, tipo }) });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      const newRegistros = result.registros || [];
      const key = tipo === 'caratula' ? 'caratulaOdsPath' : 'brendaOdsPath';
      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: filePath }) });
      setFiles(f => ({ ...f, [tipo]: { path: filePath, count: newRegistros.length } }));
      const fuente = tipo === 'caratula' ? 'caratula' : 'brenda';
      setRegistros(prev => [...prev.filter(r => !r.fuente.startsWith(fuente)), ...newRegistros]);
      showSuccess(`${newRegistros.length} registros cargados`);
    } catch (err) { showError(err.message); }
    finally { setLoading(false); }
  }, [showSuccess, showError]);

  // Navigation handlers
  const handleSelectOne = useCallback((reg) => {
    setBitacora(reg.bitacora);
    setData(buildCaratulaData(reg));
    setBatchQueue([reg]);
    setBatchIndex(0);
    setModo('editar');
    showSuccess(`${reg.bitacora}`);
  }, [showSuccess]);

  const handleCreateBlank = useCallback(() => {
    setBitacora('');
    setData({ ...CARATULA_DEFAULTS, NOMBRE_EXPEDIENTE: '', ASUNTO_EXPEDIENTE: '', NUM_LEGAJOS: '1', NUM_FOJAS: '', FECHA_APERTURA: '', FECHA_CIERRE: '' });
    setBatchQueue([]);
    setBatchIndex(-1);
    setModo('editar');
  }, []);

  const handleFilterResults = useCallback((results) => {
    setFiltrados(results);
    setModo('filtro');
  }, []);

  const handleGenerateSelected = useCallback((regs) => {
    if (regs.length === 0) return;
    setBatchQueue(regs);
    setBatchIndex(0);
    setBitacora(regs[0].bitacora);
    setData(buildCaratulaData(regs[0]));
    setModo('editar');
    showSuccess(`${regs.length} bitacoras cargadas`);
  }, [showSuccess]);

  const handleBatchNav = useCallback((dir) => {
    const next = batchIndex + dir;
    if (next < 0 || next >= batchQueue.length) return;
    setBatchIndex(next);
    setBitacora(batchQueue[next].bitacora);
    setData(buildCaratulaData(batchQueue[next]));
  }, [batchIndex, batchQueue]);

  const handleBack = useCallback(() => {
    if (modo === 'editar' && filtrados.length > 0) setModo('filtro');
    else { setModo('buscar'); setFiltrados([]); }
    setBatchQueue([]); setBatchIndex(-1);
  }, [modo, filtrados]);

  // PDF generation — client-side via canvas → jsPDF (exact copy of preview)
  const canvasToJsPdf = useCallback(async (caratulaDataArray) => {
    const { jsPDF } = await import('jspdf');
    const offscreen = document.createElement('canvas');
    const logo = editorRef.current?.getLogo();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

    for (let i = 0; i < caratulaDataArray.length; i++) {
      if (i > 0) doc.addPage();
      drawCaratula(offscreen, caratulaDataArray[i], logo, { scale: 2 });
      const imgData = offscreen.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', 0, 0, 215.9, 279.4);
    }
    return doc;
  }, []);

  const generarPdf = useCallback(async () => {
    setGenerando(true);
    try {
      const doc = await canvasToJsPdf([{ ...data, _bitacora: bitacora }]);
      doc.save(`caratula_${bitacora.replace(/\//g, '-')}.pdf`);
      showSuccess('PDF generado');
    } catch (err) { showError(err.message); }
    finally { setGenerando(false); }
  }, [data, bitacora, canvasToJsPdf, showError, showSuccess]);

  const generarTodas = useCallback(async () => {
    if (batchQueue.length === 0) return;
    setGenerando(true);
    try {
      const dataArray = batchQueue.map(reg => buildCaratulaData(reg));
      const doc = await canvasToJsPdf(dataArray);
      doc.save(`caratulas_${dataArray.length}.pdf`);
      showSuccess(`PDF con ${dataArray.length} caratulas generado`);
    } catch (err) { showError(err.message); }
    finally { setGenerando(false); }
  }, [batchQueue, canvasToJsPdf, showError, showSuccess]);

  return (
    <div className={styles.app}>
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />

      <TopBar files={files} registros={registros} loading={loading} appVersion={appVersion} onLoadFile={loadOdsFile} />

      <main className={styles.main}>
        {modo === 'buscar' && (
          <SearchView registros={registros} onSelectOne={handleSelectOne} onFilterResults={handleFilterResults} onCreateBlank={handleCreateBlank} showError={showError} />
        )}

        {modo === 'filtro' && (
          <FilterResultsView filtrados={filtrados} onBack={() => { setModo('buscar'); setFiltrados([]); }} onGenerateSelected={handleGenerateSelected} />
        )}

        {modo === 'editar' && (
          <EditorView ref={editorRef} data={data} setData={setData} bitacora={bitacora}
            batchQueue={batchQueue} batchIndex={batchIndex} onBatchNav={handleBatchNav}
            onBack={handleBack} onGeneratePdf={generarPdf} onGenerateAll={generarTodas} generando={generando} />
        )}
      </main>
    </div>
  );
}
