import { useState, useMemo } from 'react';
import { ArrowLeft, CheckSquare, Square, Download, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { Button } from '../ui';
import styles from '../../styles/caratula.module.css';

function extractTipoBitacora(b) {
  const match = String(b).match(/^\d+\/([A-Z0-9]+)-/i);
  return match ? match[1].toUpperCase() : '';
}

const PAGE_SIZE = 50;

export default function FilterResultsView({ filtrados, onBack, onGenerateSelected }) {
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const sorted = useMemo(() => {
    if (!sortCol) return filtrados;
    return [...filtrados].sort((a, b) => {
      let va = '', vb = '';
      if (sortCol === 'bitacora') { va = a.bitacora; vb = b.bitacora; }
      else if (sortCol === 'titular') { va = a.titular || ''; vb = b.titular || ''; }
      else if (sortCol === 'municipio') { va = a.municipio || ''; vb = b.municipio || ''; }
      else if (sortCol === 'tipo') { va = extractTipoBitacora(a.bitacora); vb = extractTipoBitacora(b.bitacora); }
      else if (sortCol === 'fecha') { va = a.fechaApertura || ''; vb = b.fechaApertura || ''; }
      else if (sortCol === 'fojas') { va = parseInt(a.numFojas) || 0; vb = parseInt(b.numFojas) || 0; }
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtrados, sortCol, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const toggleSeleccion = (bitacora) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(bitacora) ? next.delete(bitacora) : next.add(bitacora);
      return next;
    });
  };

  const seleccionarTodos = () => {
    if (seleccionados.size === filtrados.length) setSeleccionados(new Set());
    else setSeleccionados(new Set(filtrados.map(r => r.bitacora)));
  };

  const handleGenerate = () => {
    const regs = filtrados.filter(r => seleccionados.has(r.bitacora));
    onGenerateSelected(regs);
  };

  const SortHeader = ({ col, children }) => (
    <th onClick={() => toggleSort(col)} className={styles.sortableTh}>
      {children}
      {sortCol === col && <ArrowUpDown size={10} className={styles.sortIcon} />}
    </th>
  );

  return (
    <div className={styles.filterResultsView}>
      {/* Toolbar */}
      <div className={styles.resultsToolbar}>
        <Button variant="ghost" onClick={onBack}><ArrowLeft size={14} /> Volver</Button>
        <div className={styles.resultsInfo}>
          <span className={styles.resultsCount}>{filtrados.length} resultados</span>
          {seleccionados.size > 0 && (
            <span className={styles.selectedCount}>{seleccionados.size} seleccionados</span>
          )}
        </div>
        <div className={styles.resultsActions}>
          <Button size="sm" variant="ghost" onClick={seleccionarTodos}>
            {seleccionados.size === filtrados.length ? <CheckSquare size={14} /> : <Square size={14} />}
            {seleccionados.size === filtrados.length ? 'Deseleccionar' : 'Seleccionar todos'}
          </Button>
          <Button variant="primary" onClick={handleGenerate} disabled={seleccionados.size === 0}>
            <Download size={14} /> Generar caratulas ({seleccionados.size})
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thCheck} onClick={seleccionarTodos}>
                {seleccionados.size === filtrados.length ? <CheckSquare size={13} /> : <Square size={13} />}
              </th>
              <SortHeader col="bitacora">Bitacora</SortHeader>
              <SortHeader col="titular">Titular</SortHeader>
              <SortHeader col="municipio">Municipio</SortHeader>
              <SortHeader col="tipo">Tipo</SortHeader>
              <SortHeader col="fecha">Fecha</SortHeader>
              <SortHeader col="fojas">Fojas</SortHeader>
            </tr>
          </thead>
          <tbody>
            {pageData.map(r => {
              const checked = seleccionados.has(r.bitacora);
              return (
                <tr key={r.bitacora} onClick={() => toggleSeleccion(r.bitacora)}
                  className={checked ? styles.rowSelected : ''}>
                  <td><input type="checkbox" checked={checked} readOnly /></td>
                  <td className={styles.cellBitacora}>{r.bitacora}</td>
                  <td>{r.titular}</td>
                  <td>{r.municipio}</td>
                  <td className={styles.cellTipo}>{extractTipoBitacora(r.bitacora)}</td>
                  <td>{r.fechaApertura || r.fechaEntregaUnidad || ''}</td>
                  <td>{r.numFojas}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <Button size="sm" variant="ghost" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            <ChevronLeft size={14} />
          </Button>
          <span className={styles.pageInfo}>{page + 1} / {totalPages}</span>
          <Button size="sm" variant="ghost" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
            <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
