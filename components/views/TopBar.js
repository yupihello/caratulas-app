import { FileSpreadsheet, Database, HardDrive } from 'lucide-react';
import { Button } from '../ui';
import styles from '../../styles/caratula.module.css';

export default function TopBar({ files, registros, loading, appVersion, onLoadFile }) {
  const caratulaOk = !!files.caratula;
  const brendaOk = !!files.brenda;

  return (
    <header className={styles.topbar}>
      <div className={styles.topbarLeft}>
        <img src="/assets/logo_caratula.png" alt="" className={styles.topbarLogo} />
        <div>
          <h1 className={styles.topbarTitle}>Generador de Caratulas</h1>
          <span className={styles.topbarSubtitle}>SEMARNAT - Estado de Mexico</span>
        </div>
      </div>

      <div className={styles.topbarCenter}>
        <button className={`${styles.fileChip} ${caratulaOk ? styles.fileChipOk : ''}`} onClick={() => onLoadFile('caratula')} disabled={loading}>
          <FileSpreadsheet size={14} />
          <span>{caratulaOk ? files.caratula.path.split(/[/\\]/).pop() : 'Caratulas ODS'}</span>
          {caratulaOk && <span className={styles.fileChipCount}>{files.caratula.count}</span>}
        </button>
        <button className={`${styles.fileChip} ${brendaOk ? styles.fileChipOk : ''}`} onClick={() => onLoadFile('brenda')} disabled={loading}>
          <Database size={14} />
          <span>{brendaOk ? files.brenda.path.split(/[/\\]/).pop() : 'Base Brenda ODS'}</span>
          {brendaOk && <span className={styles.fileChipCount}>{files.brenda.count}</span>}
        </button>
      </div>

      <div className={styles.topbarRight}>
        {registros.length > 0 && (
          <span className={styles.topbarStat}>
            <HardDrive size={13} />
            {registros.length} registros
          </span>
        )}
        {appVersion && <span className={styles.versionLabel}>v{appVersion}</span>}
      </div>
    </header>
  );
}
