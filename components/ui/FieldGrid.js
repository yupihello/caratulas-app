import styles from '../../styles/ui.module.css';

export default function FieldGrid({ columns = 3, children, className }) {
  const cls = [styles.fieldGrid, className].filter(Boolean).join(' ');

  return (
    <div className={cls} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {children}
    </div>
  );
}
