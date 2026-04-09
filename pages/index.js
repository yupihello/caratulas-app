import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { drawCaratula } from '../lib/caratula-canvas';
import { Button, Input, Card, FormGroup, FieldGrid } from '../components/ui';
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

const TIPO_OPTIONS = ['Todos', 'DK', 'DJ', 'G1', 'G3', 'G9', 'A1', 'B3', 'BL', 'BT', 'BW', 'N2'];

const CLASIFICACION_FIELDS = ['FONDO', 'SECCION', 'SERIE', 'UNIDAD_ADMINISTRATIVA', 'AREA_PRODUCTORA', 'CLASIFICACION_ARCHIVISTICA'];
const EXPEDIENTE_FIELDS = ['NOMBRE_EXPEDIENTE', 'ASUNTO_EXPEDIENTE'];
const NUMEROS_FIELDS = ['NUM_LEGAJOS', 'NUM_FOJAS', 'FECHA_APERTURA', 'FECHA_CIERRE'];
const VIGENCIA_FIELDS = ['VIGENCIA_TRAMITE', 'VIGENCIA_CONCENTRACION', 'VIGENCIA_TOTAL'];
const VALOR_FIELDS = ['CHECK_ADMINISTRATIVO', 'CHECK_LEGAL', 'CHECK_FISCAL', 'CHECK_CONTABLE'];
const DESTINO_FIELDS = ['CHECK_BAJA', 'CHECK_CONSERVACION', 'CHECK_MUESTREO', 'CHECK_PUBLICA', 'CHECK_RESERVADA', 'CHECK_CONFIDENCIAL'];
const SOPORTE_FIELDS = ['CHECK_PAPEL', 'CHECK_ELECTRONICO', 'CHECK_PLANO', 'CHECK_FOTOGRAFIA', 'CHECK_ESPECIAL', 'CHECK_OTRA'];

function CheckboxGroup({ label, fields, data, onChange }) {
  return (
    <div className={styles.checkGroup}>
      <p className={styles.checkGroupLabel}>{label}</p>
      <FieldGrid columns={3}>
        {fields.map(field => (
          <label key={field} className={styles.checkItem}>
            <input type="checkbox" checked={!!data[field]} onChange={e => onChange(field, e.target.checked)} />
            <span>{field.replace('CHECK_', '')}</span>
          </label>
        ))}
      </FieldGrid>
    </div>
  );
}

function HighlightMatch({ text, query }) {
  if (!query || !text) return <>{text}</>;
  const idx = text.toUpperCase().indexOf(query.toUpperCase());
  if (idx === -1) return <>{text}</>;
  return <>{text.slice(0, idx)}<mark>{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>;
}

function Toast({ message, type, visible }) {
  const cls = [styles.toast, type === 'error' ? styles.toastError : styles.toastSuccess, !visible && styles.toastHidden].filter(Boolean).join(' ');
  return <div className={cls}>{message}</div>;
}

function extractTipoBitacora(b) {
  const match = String(b).match(/^\d+\/([A-Z0-9]+)-/i);
  return match ? match[1].toUpperCase() : '';
}

function buildCaratulaData(reg) {
  const tipo = extractTipoBitacora(reg.bitacora);
  const asunto = CARATULA_ASUNTO_MAP[tipo] || reg.asunto || '';
  const nombre = [reg.titular, reg.municipio].filter(Boolean).join(' - ');
  return {
    ...CARATULA_DEFAULTS,
    NOMBRE_EXPEDIENTE: nombre,
    ASUNTO_EXPEDIENTE: asunto,
    NUM_LEGAJOS: reg.numLegajos || '1',
    NUM_FOJAS: reg.numFojas || '',
    FECHA_APERTURA: reg.fechaEntregaUnidad || reg.fechaApertura || '',
    FECHA_CIERRE: reg.fechaCierre || '',
    _bitacora: reg.bitacora,
  };
}

export default function CaratulaPage() {
  const [registros, setRegistros] = useState([]);
  const [files, setFiles] = useState({ caratula: null, brenda: null });
  const [loading, setLoading] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success', visible: false });
  const [appVersion, setAppVersion] = useState('');

  // Search / autocomplete
  const [bitacora, setBitacora] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filter panel
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtrados, setFiltrados] = useState([]);
  const [seleccionados, setSeleccionados] = useState(new Set());

  // Editor
  const [modo, setModo] = useState('buscar'); // buscar | filtro | editar
  const [data, setData] = useState({ ...CARATULA_DEFAULTS, NOMBRE_EXPEDIENTE: '', ASUNTO_EXPEDIENTE: '', NUM_LEGAJOS: '1', NUM_FOJAS: '', FECHA_APERTURA: '', FECHA_CIERRE: '' });
  const [batchQueue, setBatchQueue] = useState([]);
  const [batchIndex, setBatchIndex] = useState(-1);

  const canvasRef = useRef(null);
  const logoRef = useRef(null);
  const suggestionsRef = useRef(null);
  const inputRef = useRef(null);

  const showSuccess = useCallback((msg) => {
    setToast({ message: msg, type: 'success', visible: true });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  }, []);
  const showError = useCallback((msg) => {
    setToast({ message: msg, type: 'error', visible: true });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  }, []);

  // Preload logo + fetch version
  useEffect(() => {
    const img = new Image();
    img.src = '/assets/logo_caratula.png';
    img.onload = () => { logoRef.current = img; };
    logoRef.current = img;
    fetch('/api/version').then(r => r.json()).then(d => setAppVersion(d.version)).catch(() => {});
  }, []);

  // Auto-load saved files
  useEffect(() => {
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

  // Canvas preview
  useEffect(() => {
    if (canvasRef.current && modo === 'editar') {
      drawCaratula(canvasRef.current, data, logoRef.current);
    }
  }, [data, modo]);

  // ── Search / Suggestions ──
  const searchRegistros = useCallback((query) => {
    if (!query || query.length < 2) return [];
    const q = query.toUpperCase();
    const results = [];
    for (const r of registros) {
      if (r.bitacora.toUpperCase().includes(q) || (r.titular || '').toUpperCase().includes(q) || (r.municipio || '').toUpperCase().includes(q)) {
        results.push(r);
        if (results.length >= 5) break;
      }
    }
    return results;
  }, [registros]);

  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    setBitacora(val);
    const matches = searchRegistros(val);
    setSuggestions(matches);
    setActiveIdx(-1);
    setShowSuggestions(matches.length > 0);
  }, [searchRegistros]);

  const selectSuggestion = useCallback((reg) => {
    setShowSuggestions(false);
    setBitacora(reg.bitacora);
    setData(buildCaratulaData(reg));
    setBatchQueue([reg]);
    setBatchIndex(0);
    setModo('editar');
    showSuccess(`Registro: ${reg.bitacora}`);
  }, [showSuccess]);

  const handleKeyDown = useCallback((e) => {
    if (!showSuggestions) { if (e.key === 'Enter') buscarUno(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); activeIdx >= 0 && suggestions[activeIdx] ? selectSuggestion(suggestions[activeIdx]) : buscarUno(); }
    else if (e.key === 'Escape') setShowSuggestions(false);
  }, [showSuggestions, activeIdx, suggestions, selectSuggestion]);

  useEffect(() => {
    const h = (e) => { if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) && inputRef.current && !inputRef.current.contains(e.target)) setShowSuggestions(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const buscarUno = useCallback(() => {
    setShowSuggestions(false);
    const q = bitacora.trim().toUpperCase();
    if (!q) { showError('Ingrese una bitacora'); return; }
    const found = registros.find(r => r.bitacora.toUpperCase() === q);
    if (found) { selectSuggestion(found); return; }
    const partial = registros.filter(r => r.bitacora.toUpperCase().includes(q));
    if (partial.length === 1) { selectSuggestion(partial[0]); return; }
    if (partial.length > 1) { showError(`${partial.length} resultados. Sea mas especifico.`); return; }
    showError('No encontrado. Editor con valores por defecto.');
    setData({ ...CARATULA_DEFAULTS, NOMBRE_EXPEDIENTE: '', ASUNTO_EXPEDIENTE: '', NUM_LEGAJOS: '1', NUM_FOJAS: '', FECHA_APERTURA: '', FECHA_CIERRE: '' });
    setBatchQueue([]); setBatchIndex(-1);
    setModo('editar');
  }, [bitacora, registros, showError, selectSuggestion]);

  // ── Filtro ──
  const parseDateStr = (str) => {
    if (!str) return null;
    // Try dd/mm/yyyy
    const m = String(str).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    // Try yyyy-mm-dd
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  };

  const aplicarFiltro = useCallback(() => {
    let results = [...registros];

    if (filtroTipo !== 'Todos') {
      results = results.filter(r => extractTipoBitacora(r.bitacora) === filtroTipo);
    }

    if (filtroTexto.trim()) {
      const q = filtroTexto.trim().toUpperCase();
      results = results.filter(r =>
        r.bitacora.toUpperCase().includes(q) ||
        (r.titular || '').toUpperCase().includes(q) ||
        (r.municipio || '').toUpperCase().includes(q)
      );
    }

    if (filtroFechaDesde) {
      const desde = new Date(filtroFechaDesde);
      results = results.filter(r => {
        const d = parseDateStr(r.fechaApertura || r.fechaEntregaUnidad);
        return d && d >= desde;
      });
    }
    if (filtroFechaHasta) {
      const hasta = new Date(filtroFechaHasta);
      hasta.setHours(23, 59, 59);
      results = results.filter(r => {
        const d = parseDateStr(r.fechaApertura || r.fechaEntregaUnidad);
        return d && d <= hasta;
      });
    }

    setFiltrados(results);
    setSeleccionados(new Set());
    setModo('filtro');
  }, [registros, filtroTipo, filtroTexto, filtroFechaDesde, filtroFechaHasta]);

  const toggleSeleccion = (bitacora) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(bitacora) ? next.delete(bitacora) : next.add(bitacora);
      return next;
    });
  };

  const seleccionarTodos = () => {
    if (seleccionados.size === filtrados.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(filtrados.map(r => r.bitacora)));
    }
  };

  // ── Batch: cargar seleccionados al editor ──
  const cargarSeleccionados = useCallback(() => {
    const regs = filtrados.filter(r => seleccionados.has(r.bitacora));
    if (regs.length === 0) { showError('Seleccione al menos una bitacora'); return; }
    setBatchQueue(regs);
    setBatchIndex(0);
    const first = regs[0];
    setBitacora(first.bitacora);
    setData(buildCaratulaData(first));
    setModo('editar');
    showSuccess(`${regs.length} bitacoras cargadas`);
  }, [filtrados, seleccionados, showSuccess, showError]);

  const batchNav = useCallback((dir) => {
    const next = batchIndex + dir;
    if (next < 0 || next >= batchQueue.length) return;
    setBatchIndex(next);
    const reg = batchQueue[next];
    setBitacora(reg.bitacora);
    setData(buildCaratulaData(reg));
  }, [batchIndex, batchQueue]);

  // ── PDF ──
  const generarPdf = useCallback(async () => {
    setGenerando(true);
    try {
      const res = await fetch('/api/generate-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { ...data, _bitacora: bitacora }, useSaveDialog: true }),
      });
      const result = await res.json();
      if (result.saved) showSuccess(`PDF guardado: ${result.path}`);
      else if (result.error) showError(result.error);
    } catch (err) { showError(err.message); }
    finally { setGenerando(false); }
  }, [data, bitacora, showError, showSuccess]);

  const generarTodas = useCallback(async () => {
    if (batchQueue.length === 0) return;
    setGenerando(true);
    try {
      const dataArray = batchQueue.map(reg => buildCaratulaData(reg));
      const res = await fetch('/api/generate-pdf-multi', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataArray }),
      });
      const result = await res.json();
      if (result.saved) showSuccess(`PDF guardado con ${result.count} caratulas: ${result.path}`);
      else if (result.error) showError(result.error);
    } catch (err) { showError(err.message); }
    finally { setGenerando(false); }
  }, [batchQueue, showError, showSuccess]);

  const updateField = (field, value) => setData(prev => ({ ...prev, [field]: value }));

  const limpiar = () => {
    setBitacora(''); setModo('buscar');
    setData({ ...CARATULA_DEFAULTS, NOMBRE_EXPEDIENTE: '', ASUNTO_EXPEDIENTE: '', NUM_LEGAJOS: '1', NUM_FOJAS: '', FECHA_APERTURA: '', FECHA_CIERRE: '' });
    setSuggestions([]); setShowSuggestions(false);
    setBatchQueue([]); setBatchIndex(-1);
    setFiltrados([]); setSeleccionados(new Set());
  };

  // ── File loading ──
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
      showSuccess(`${newRegistros.length} registros cargados de ${filePath.split(/[/\\]/).pop()}`);
    } catch (err) { showError(err.message); }
    finally { setLoading(false); }
  }, [showSuccess, showError]);

  return (
    <div className={styles.app}>
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />

      {/* Top bar */}
      <header className={styles.topbar}>
        <h1 className={styles.topbarTitle}>Generador de Caratulas</h1>
        <div className={styles.topbarFiles}>
          <div className={styles.fileSlot}>
            <Button size="sm" onClick={() => loadOdsFile('caratula')} disabled={loading}>Cargar Caratulas ODS</Button>
            <span className={`${styles.fileLabel} ${files.caratula ? styles.fileLabelLoaded : ''}`}>
              {files.caratula ? `${files.caratula.path.split(/[/\\]/).pop()} (${files.caratula.count})` : 'Sin archivo'}
            </span>
          </div>
          <div className={styles.fileSlot}>
            <Button size="sm" onClick={() => loadOdsFile('brenda')} disabled={loading}>Cargar Base Brenda ODS</Button>
            <span className={`${styles.fileLabel} ${files.brenda ? styles.fileLabelLoaded : ''}`}>
              {files.brenda ? `${files.brenda.path.split(/[/\\]/).pop()} (${files.brenda.count})` : 'Sin archivo'}
            </span>
          </div>
          {registros.length > 0 && <span className={styles.recordCount}>{registros.length} registros</span>}
          {appVersion && <span className={styles.versionLabel}>v{appVersion}</span>}
        </div>
      </header>

      <main className={styles.main}>
        {/* ── Mode: buscar ── */}
        {modo === 'buscar' && (
          <>
            {/* Search */}
            <div className={styles.searchRow}>
              <div className={styles.searchWrapper}>
                <Input ref={inputRef} value={bitacora} onChange={handleInputChange} onKeyDown={handleKeyDown}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="Buscar bitacora o nombre..." autoComplete="off" />
                {showSuggestions && suggestions.length > 0 && (
                  <ul className={styles.suggestions} ref={suggestionsRef}>
                    {suggestions.map((reg, i) => (
                      <li key={reg.bitacora + i}
                        className={`${styles.suggestionItem} ${i === activeIdx ? styles.suggestionItemActive : ''}`}
                        onMouseDown={() => selectSuggestion(reg)} onMouseEnter={() => setActiveIdx(i)}>
                        <span className={styles.sgBitacora}><HighlightMatch text={reg.bitacora} query={bitacora} /></span>
                        <span className={styles.sgDetail}><HighlightMatch text={[reg.titular, reg.municipio].filter(Boolean).join(' - ')} query={bitacora} /></span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button variant="primary" onClick={buscarUno} disabled={loading}>Buscar</Button>
            </div>

            {/* Filter panel */}
            <Card variant="form" title="Filtrar para generar en lote">
              <FieldGrid columns={4}>
                <FormGroup label="Tipo de tramite">
                  <select className={styles.selectInput} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                    {TIPO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormGroup>
                <FormGroup label="Fecha desde">
                  <input type="date" className={styles.selectInput} value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)} />
                </FormGroup>
                <FormGroup label="Fecha hasta">
                  <input type="date" className={styles.selectInput} value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)} />
                </FormGroup>
                <FormGroup label="Texto (titular/municipio)">
                  <Input value={filtroTexto} onChange={e => setFiltroTexto(e.target.value)} placeholder="Filtrar..." />
                </FormGroup>
              </FieldGrid>
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <Button variant="primary" onClick={aplicarFiltro} disabled={registros.length === 0}>
                  Filtrar ({registros.length} registros)
                </Button>
              </div>
            </Card>
          </>
        )}

        {/* ── Mode: filtro (results table) ── */}
        {modo === 'filtro' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <Button onClick={limpiar}>Volver</Button>
              <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12 }}>
                {filtrados.length} resultados
              </span>
              <Button size="sm" onClick={seleccionarTodos}>
                {seleccionados.size === filtrados.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </Button>
              <Button variant="primary" onClick={cargarSeleccionados} disabled={seleccionados.size === 0}>
                Generar caratulas ({seleccionados.size})
              </Button>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: 30 }}></th>
                    <th>Bitacora</th>
                    <th>Titular</th>
                    <th>Municipio</th>
                    <th>Tipo</th>
                    <th>Fecha Apertura</th>
                    <th>Fojas</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(r => (
                    <tr key={r.bitacora} onClick={() => toggleSeleccion(r.bitacora)} style={{ cursor: 'pointer' }}>
                      <td><input type="checkbox" checked={seleccionados.has(r.bitacora)} readOnly /></td>
                      <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{r.bitacora}</td>
                      <td>{r.titular}</td>
                      <td>{r.municipio}</td>
                      <td>{extractTipoBitacora(r.bitacora)}</td>
                      <td>{r.fechaApertura || r.fechaEntregaUnidad || ''}</td>
                      <td>{r.numFojas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Mode: editar ── */}
        {modo === 'editar' && (
          <>
            {/* Batch navigation */}
            {batchQueue.length > 1 && (
              <div className={styles.batchBar}>
                <Button size="sm" onClick={() => batchNav(-1)} disabled={batchIndex <= 0}>
                  &#9664; Anterior
                </Button>
                <span className={styles.batchInfo}>
                  {batchIndex + 1} de {batchQueue.length} bitacoras
                </span>
                <Button size="sm" onClick={() => batchNav(1)} disabled={batchIndex >= batchQueue.length - 1}>
                  Siguiente &#9654;
                </Button>
                <Button size="sm" variant="primary" onClick={generarTodas} disabled={generando} loading={generando}>
                  {generando ? 'Generando...' : `Generar Todas (${batchQueue.length}) - PDF unico`}
                </Button>
                <Button size="sm" onClick={limpiar}>Volver</Button>
              </div>
            )}
            {batchQueue.length <= 1 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <Button onClick={limpiar}>Volver</Button>
                {bitacora && <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>{bitacora}</span>}
              </div>
            )}

            <div className={styles.editorLayout}>
              {/* Form */}
              <div className={styles.formColumn}>
                <Card variant="form" title="Clasificacion">
                  {CLASIFICACION_FIELDS.map(field => (
                    <FormGroup key={field} label={field.replace(/_/g, ' ')}>
                      <Input value={data[field] || ''} onChange={e => updateField(field, e.target.value)} />
                    </FormGroup>
                  ))}
                </Card>
                <Card variant="form" title="Expediente">
                  {EXPEDIENTE_FIELDS.map(field => (
                    <FormGroup key={field} label={field.replace(/_/g, ' ')}>
                      <Input value={data[field] || ''} onChange={e => updateField(field, e.target.value)} />
                    </FormGroup>
                  ))}
                </Card>
                <Card variant="form" title="Numeros y Fechas">
                  <FieldGrid columns={2}>
                    {NUMEROS_FIELDS.map(field => (
                      <FormGroup key={field} label={field.replace(/_/g, ' ')}>
                        <Input value={data[field] || ''} onChange={e => updateField(field, e.target.value)} />
                      </FormGroup>
                    ))}
                  </FieldGrid>
                </Card>
                <Card variant="form" title="Vigencia Documental">
                  <FieldGrid columns={2}>
                    {VIGENCIA_FIELDS.map(field => (
                      <FormGroup key={field} label={field.replace(/_/g, ' ')}>
                        <Input value={data[field] || ''} onChange={e => updateField(field, e.target.value)} />
                      </FormGroup>
                    ))}
                  </FieldGrid>
                </Card>
                <CheckboxGroup label="Valor Documental" fields={VALOR_FIELDS} data={data} onChange={updateField} />
                <CheckboxGroup label="Destino Final" fields={DESTINO_FIELDS} data={data} onChange={updateField} />
                <CheckboxGroup label="Soporte Documental" fields={SOPORTE_FIELDS} data={data} onChange={updateField} />
                <div className={styles.formActions}>
                  <Button variant="primary" onClick={generarPdf} disabled={generando} loading={generando} style={{ width: '100%' }}>
                    {generando ? 'Generando...' : 'Generar PDF (esta caratula)'}
                  </Button>
                </div>
              </div>

              {/* Preview */}
              <div className={styles.previewColumn}>
                <h3 className={styles.previewTitle}>Preview</h3>
                <div className={styles.previewWrap}>
                  <canvas ref={canvasRef} width={816} height={1056} className={styles.previewCanvas} />
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
