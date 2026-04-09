import { forwardRef } from 'react';
import styles from '../../styles/ui.module.css';

const Input = forwardRef(function Input({ type = 'text', label, placeholder, value, onChange, disabled, className, ...rest }, ref) {
  const inputCls = [styles.input, className].filter(Boolean).join(' ');

  return (
    <div className={styles.inputWrap}>
      {label && <label className={styles.fieldLabel}>{label}</label>}
      <input
        ref={ref}
        type={type}
        className={inputCls}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        {...rest}
      />
    </div>
  );
});

export default Input;
