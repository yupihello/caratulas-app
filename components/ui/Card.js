import styles from '../../styles/ui.module.css';

export default function Card({ variant = 'form', title, children, className }) {
  const cls = [
    styles.card,
    styles[`card_${variant}`],
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      {title && <div className={styles.cardTitle}>{title}</div>}
      {children}
    </div>
  );
}
