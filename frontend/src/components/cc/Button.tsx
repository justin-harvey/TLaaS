'use client';
import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  icon?: React.ReactNode;
  iconRight?: boolean;
  full?: boolean;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
}

const base = 'inline-flex items-center gap-1.5 font-sans font-medium rounded-xs transition-all duration-[120ms] cursor-pointer select-none active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40';
const sizes = { sm: 'h-7 px-3 text-xs', md: 'h-8 px-4 text-sm', lg: 'h-10 px-5 text-sm' };
const variants = {
  primary:   'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-card border border-line text-ink hover:bg-card-raised',
  ghost:     'text-muted hover:text-ink hover:bg-black/5',
  danger:    'bg-spike text-white hover:bg-[#8a3a2e]',
};

export function Button({ children, variant = 'primary', size = 'md', disabled, icon, iconRight, full, style, onClick, type = 'button' }: ButtonProps) {
  return (
    <button type={type} disabled={disabled} style={style} onClick={onClick}
      className={cn(base, sizes[size], variants[variant], full && 'w-full justify-center')}>
      {icon && !iconRight && <span className="w-[1em] h-[1em] flex items-center">{icon}</span>}
      {children}
      {icon && iconRight && <span className="w-[1em] h-[1em] flex items-center">{icon}</span>}
    </button>
  );
}
