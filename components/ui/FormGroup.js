import styles from '../../styles/ui.module.css';

export default function FormGroup({ label, children, className }) {
  const cls = [styles.formGroup, className].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      {label && <span className={styles.fieldLabel}>{label}</span>}
      {children}
    </div>
  );
}
