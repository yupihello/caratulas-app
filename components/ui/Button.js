import styles from '../../styles/ui.module.css';

export default function Button({ variant = 'secondary', size = 'md', disabled, loading, children, className, ...props }) {
  const cls = [
    styles.btn,
    styles[`btn_${variant}`],
    styles[`btn_${size}`],
    loading && styles.btn_loading,
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={cls} disabled={disabled || loading} {...props}>
      {loading && <span className={styles.btnSpinner} />}
      {children}
    </button>
  );
}
