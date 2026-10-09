import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-teal-600 text-white shadow-sm hover:bg-teal-700 focus-visible:ring-teal-500',
  secondary:
    'border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:ring-slate-400',
  ghost:
    'border-transparent bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400',
  danger:
    'border-transparent bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus-visible:ring-rose-500',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const sizeClasses =
    size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-3.5 text-sm';

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses} ${className}`}
      {...props}
    />
  );
}
