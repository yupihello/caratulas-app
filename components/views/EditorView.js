import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Download, FileText, SkipBack, SkipForward } from 'lucide-react';
import { drawCaratula } from '../../lib/caratula-canvas';
import { Button, Input, Card, FormGroup, FieldGrid } from '../ui';
import styles from '../../styles/caratula.module.css';

const CLASIFICACION_FIELDS = ['FONDO', 'SECCION', 'SERIE', 'UNIDAD_ADMINISTRATIVA', 'AREA_PRODUCTORA', 'CLASIFICACION_ARCHIVISTICA'];
const EXPEDIENTE_FIELDS = ['NOMBRE_EXPEDIENTE', 'ASUNTO_EXPEDIENTE'];
const NUMEROS_FIELDS = ['NUM_LEGAJOS', 'NUM_FOJAS', 'FECHA_APERTURA', 'FECHA_CIERRE'];
const VIGENCIA_FIELDS = ['VIGENCIA_TRAMITE', 'VIGENCIA_CONCENTRACION', 'VIGENCIA_TOTAL'];
const VALOR_FIELDS = ['CHECK_ADMINISTRATIVO', 'CHECK_LEGAL', 'CHECK_FISCAL', 'CHECK_CONTABLE'];
const DESTINO_FIELDS = ['CHECK_BAJA', 'CHECK_CONSERVACION', 'CHECK_MUESTREO', 'CHECK_PUBLICA', 'CHECK_RESERVADA', 'CHECK_CONFIDENCIAL'];
const SOPORTE_FIELDS = ['CHECK_PAPEL', 'CHECK_ELECTRONICO', 'CHECK_PLANO', 'CHECK_FOTOGRAFIA', 'CHECK_ESPECIAL', 'CHECK_OTRA'];

function CollapsibleSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={styles.collapsible}>
      <button className={styles.collapsibleHeader} onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>{title}</span>
      </button>
      {open && <div className={styles.collapsibleBody}>{children}</div>}
    </div>
  );
}

function CheckboxGroup({ label, fields, data, onChange }) {
  return (
    <div className={styles.checkGroup}>
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

const EditorView = forwardRef(function EditorView({ data, setData, bitacora, batchQueue, batchIndex, onBatchNav, onBack, onGeneratePdf, onGenerateAll, generando }, ref) {
  const canvasRef = useRef(null);
  const logoRef = useRef(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const img = new Image();
    img.src = '/assets/logo_caratula.png';
    img.onload = () => { logoRef.current = img; };
    logoRef.current = img;
  }, []);

  useEffect(() => {
    if (canvasRef.current) drawCaratula(canvasRef.current, data, logoRef.current);
  }, [data]);

  // Expose drawCaratula + logoRef to parent for PDF generation
  useImperativeHandle(ref, () => ({
    renderToCanvas(canvasEl, caratulaData) {
      drawCaratula(canvasEl, caratulaData, logoRef.current, { scale: 2 });
    },
    getLogo() { return logoRef.current; },
  }));

  const updateField = (field, value) => setData(prev => ({ ...prev, [field]: value }));

  const handleWheel = useCallback((e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      setZoom(z => Math.max(0.3, Math.min(2, z + (e.deltaY > 0 ? -0.1 : 0.1))));
    }
  }, []);

  const isBatch = batchQueue.length > 1;

  return (
    <div className={styles.editorView}>
      {/* Top bar */}
      <div className={styles.editorToolbar}>
        <Button variant="ghost" onClick={onBack}><ArrowLeft size={14} /> Volver</Button>

        {isBatch ? (
          <div className={styles.batchNav}>
            <Button size="sm" variant="ghost" onClick={() => onBatchNav(-1)} disabled={batchIndex <= 0}>
              <SkipBack size={13} />
            </Button>
            <span className={styles.batchInfo}>
              <strong>{batchIndex + 1}</strong> / {batchQueue.length}
              <span className={styles.batchName}>{bitacora}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => onBatchNav(1)} disabled={batchIndex >= batchQueue.length - 1}>
              <SkipForward size={13} />
            </Button>
          </div>
        ) : (
          <span className={styles.editorBitacora}><FileText size={14} /> {bitacora}</span>
        )}

        <div className={styles.editorActions}>
          <Button onClick={onGeneratePdf} disabled={generando} loading={generando}>
            <Download size={14} /> {generando ? 'Generando...' : 'PDF esta'}
          </Button>
          {isBatch && (
            <Button variant="primary" onClick={onGenerateAll} disabled={generando} loading={generando}>
              <Download size={14} /> {generando ? 'Generando...' : `PDF todas (${batchQueue.length})`}
            </Button>
          )}
        </div>
      </div>

      <div className={styles.editorLayout}>
        {/* Form */}
        <div className={styles.formColumn}>
          <CollapsibleSection title="Clasificacion" defaultOpen={false}>
            {CLASIFICACION_FIELDS.map(field => (
              <FormGroup key={field} label={field.replace(/_/g, ' ')}>
                <Input value={data[field] || ''} onChange={e => updateField(field, e.target.value)} />
              </FormGroup>
            ))}
          </CollapsibleSection>

          <CollapsibleSection title="Expediente" defaultOpen={true}>
            {EXPEDIENTE_FIELDS.map(field => (
              <FormGroup key={field} label={field.replace(/_/g, ' ')}>
                <Input value={data[field] || ''} onChange={e => updateField(field, e.target.value)} />
              </FormGroup>
            ))}
          </CollapsibleSection>

          <CollapsibleSection title="Numeros y Fechas" defaultOpen={true}>
            <FieldGrid columns={2}>
              {NUMEROS_FIELDS.map(field => (
                <FormGroup key={field} label={field.replace(/_/g, ' ')}>
                  <Input value={data[field] || ''} onChange={e => updateField(field, e.target.value)} />
                </FormGroup>
              ))}
            </FieldGrid>
          </CollapsibleSection>

          <CollapsibleSection title="Vigencia Documental" defaultOpen={false}>
            <FieldGrid columns={3}>
              {VIGENCIA_FIELDS.map(field => (
                <FormGroup key={field} label={field.replace(/_/g, ' ')}>
                  <Input value={data[field] || ''} onChange={e => updateField(field, e.target.value)} />
                </FormGroup>
              ))}
            </FieldGrid>
          </CollapsibleSection>

          <CollapsibleSection title="Valor Documental" defaultOpen={false}>
            <CheckboxGroup fields={VALOR_FIELDS} data={data} onChange={updateField} />
          </CollapsibleSection>

          <CollapsibleSection title="Destino Final" defaultOpen={false}>
            <CheckboxGroup fields={DESTINO_FIELDS} data={data} onChange={updateField} />
          </CollapsibleSection>

          <CollapsibleSection title="Soporte Documental" defaultOpen={false}>
            <CheckboxGroup fields={SOPORTE_FIELDS} data={data} onChange={updateField} />
          </CollapsibleSection>
        </div>

        {/* Preview */}
        <div className={styles.previewColumn} onWheel={handleWheel}>
          <div className={styles.previewWrap}>
            <canvas ref={canvasRef} width={816} height={1056} className={styles.previewCanvas}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }} />
          </div>
        </div>
      </div>
    </div>
  );
});

export default EditorView;
