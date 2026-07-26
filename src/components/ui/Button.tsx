import type { ReactNode, ButtonHTMLAttributes } from 'react';
import './Button.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const classes = [
    'afo-btn',
    `afo-btn--${variant}`,
    size === 'sm' && 'afo-btn--sm',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button disabled={disabled} className={classes} {...props}>
      {children}
    </button>
  );
}

export default Button;
