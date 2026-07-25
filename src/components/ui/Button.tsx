import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: string;
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const base = 'rounded-pill px-4 py-2 text-[12.5px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const variants: Record<string, string> = {
    primary: 'bg-accent text-accent-contrast hover:brightness-110',
    secondary: 'bg-bg text-text border border-border hover:border-border-strong',
    ghost: 'bg-transparent text-text-dim hover:text-text hover:bg-black/5 dark:hover:bg-white/5',
    danger: 'bg-danger/10 text-danger hover:bg-danger/15',
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export default Button;
