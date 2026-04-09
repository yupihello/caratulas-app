import { useState, useRef, useCallback, useEffect } from 'react';
import { Search, Filter, X, FileDown, FilePlus } from 'lucide-react';
import { Button, Input, Card, FormGroup, FieldGrid } from '../ui';
import styles from '../../styles/caratula.module.css';

const TIPO_OPTIONS = ['Todos', 'DK', 'DJ', 'G1', 'G3', 'G9', 'A1', 'B3', 'BL', 'BT', 'BW', 'N2'];

function HighlightMatch({ text, query }) {
  if (!query || !text) return <>{text}</>;
  const idx = text.toUpperCase().indexOf(query.toUpperCase());
  if (idx === -1) return <>{text}</>;
  return <>{text.slice(0, idx)}<mark>{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>;
}

function extractTipoBitacora(b) {
  const match = String(b).match(/^\d+\/([A-Z0-9]+)-/i);
  return match ? match[1].toUpperCase() : '';
}

export default function SearchView({ registros, onSelectOne, onFilterResults, onCreateBlank, showError }) {
  const [bitacora, setBitacora] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filters
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [filtroTexto, setFiltroTexto] = useState('');

  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Stats by type
  const tipoStats = {};
  for (const r of registros) {
    const t = extractTipoBitacora(r.bitacora);
    tipoStats[t] = (tipoStats[t] || 0) + 1;
  }

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
    setBitacora('');
    onSelectOne(reg);
  }, [onSelectOne]);

  const buscarUno = useCallback(() => {
    setShowSuggestions(false);
    const q = bitacora.trim().toUpperCase();
    if (!q) { showError('Ingrese una bitacora'); return; }
    const found = registros.find(r => r.bitacora.toUpperCase() === q);
    if (found) { selectSuggestion(found); return; }
    const partial = registros.filter(r => r.bitacora.toUpperCase().includes(q));
    if (partial.length === 1) { selectSuggestion(partial[0]); return; }
    if (partial.length > 1) { showError(`${partial.length} resultados. Sea mas especifico.`); return; }
    showError('No encontrado en los archivos ODS.');
  }, [bitacora, registros, showError, selectSuggestion]);

  const handleKeyDown = useCallback((e) => {
    if (!showSuggestions) { if (e.key === 'Enter') buscarUno(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); activeIdx >= 0 && suggestions[activeIdx] ? selectSuggestion(suggestions[activeIdx]) : buscarUno(); }
    else if (e.key === 'Escape') setShowSuggestions(false);
  }, [showSuggestions, activeIdx, suggestions, selectSuggestion, buscarUno]);

  useEffect(() => {
    const h = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) && inputRef.current && !inputRef.current.contains(e.target))
        setShowSuggestions(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const parseDateStr = (str) => {
    if (!str) return null;
    const m = String(str).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  };

  const aplicarFiltro = useCallback((tipoOverride) => {
    const tipo = tipoOverride || filtroTipo;
    let results = [...registros];

    if (tipo !== 'Todos') results = results.filter(r => extractTipoBitacora(r.bitacora) === tipo);
    if (filtroTexto.trim()) {
      const q = filtroTexto.trim().toUpperCase();
      results = results.filter(r => r.bitacora.toUpperCase().includes(q) || (r.titular || '').toUpperCase().includes(q) || (r.municipio || '').toUpperCase().includes(q));
    }
    if (filtroFechaDesde) {
      const desde = new Date(filtroFechaDesde);
      results = results.filter(r => { const d = parseDateStr(r.fechaApertura || r.fechaEntregaUnidad); return d && d >= desde; });
    }
    if (filtroFechaHasta) {
      const hasta = new Date(filtroFechaHasta); hasta.setHours(23, 59, 59);
      results = results.filter(r => { const d = parseDateStr(r.fechaApertura || r.fechaEntregaUnidad); return d && d <= hasta; });
    }
    onFilterResults(results);
  }, [registros, filtroTipo, filtroTexto, filtroFechaDesde, filtroFechaHasta, onFilterResults]);

  const limpiarFiltros = () => {
    setFiltroTipo('Todos'); setFiltroFechaDesde(''); setFiltroFechaHasta(''); setFiltroTexto('');
  };

  const quickFilter = (tipo) => {
    setFiltroTipo(tipo);
    aplicarFiltro(tipo);
  };

  if (registros.length === 0) {
    return (
      <div className={styles.emptyState}>
        <FileDown size={48} strokeWidth={1} />
        <h2>Sin datos cargados</h2>
        <p>Carga los archivos ODS desde la barra superior, o crea una caratula manualmente.</p>
        <Button variant="primary" onClick={onCreateBlank}><FilePlus size={14} /> Crear caratula en blanco</Button>
      </div>
    );
  }

  return (
    <div className={styles.searchView}>
      {/* Search */}
      <div className={styles.searchRow}>
        <div className={styles.searchWrapper}>
          <Search size={15} className={styles.searchIcon} />
          <Input ref={inputRef} value={bitacora} onChange={handleInputChange} onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Buscar por bitacora, titular o municipio..." autoComplete="off" />
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
        <Button variant="primary" onClick={buscarUno}><Search size={14} /> Buscar</Button>
        <Button onClick={onCreateBlank}><FilePlus size={14} /> En blanco</Button>
      </div>

      {/* Quick stats */}
      <div className={styles.statsRow}>
        {Object.entries(tipoStats).sort((a, b) => b[1] - a[1]).map(([tipo, count]) => (
          <button key={tipo} className={`${styles.statChip} ${filtroTipo === tipo ? styles.statChipActive : ''}`}
            onClick={() => quickFilter(tipo)}>
            <span className={styles.statChipType}>{tipo}</span>
            <span className={styles.statChipCount}>{count}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <Filter size={14} className={styles.filterIcon} />
        <select className={styles.selectInput} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          {TIPO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="date" className={styles.selectInput} value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)} placeholder="Desde" />
        <input type="date" className={styles.selectInput} value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)} placeholder="Hasta" />
        <Input value={filtroTexto} onChange={e => setFiltroTexto(e.target.value)} placeholder="Titular o municipio..." />
        <Button variant="primary" onClick={() => aplicarFiltro()}><Filter size={14} /> Filtrar</Button>
        {(filtroTipo !== 'Todos' || filtroFechaDesde || filtroFechaHasta || filtroTexto) && (
          <Button variant="ghost" onClick={limpiarFiltros}><X size={14} /></Button>
        )}
      </div>
    </div>
  );
}
