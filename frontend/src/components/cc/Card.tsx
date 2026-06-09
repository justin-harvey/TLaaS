import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps {
  children?: React.ReactNode;
  title?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  padded?: boolean;
  raised?: boolean;
  accent?: string;  // CSS color for top accent bar
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  className?: string;
}

export function Card({ children, title, eyebrow, actions, padded = true, raised, accent, style, bodyStyle, className }: CardProps) {
  const hasHeader = !!(title || eyebrow || actions);
  return (
    <div style={style}
      className={cn('border border-[#DDD3BE] rounded-md shadow-sm overflow-hidden', raised ? 'bg-[#FFFDF8]' : 'bg-[#FBF7EE]', className)}>
      {accent && <div className="h-[3px]" style={{ background: accent }} />}
      {hasHeader && (
        <div className="flex items-start justify-between px-4 py-3 border-b border-[#DDD3BE]">
          <div>
            {eyebrow && <p className="type-label mb-0.5">{eyebrow}</p>}
            {title && <h3 className="font-sans text-[15px] font-semibold text-ink">{title}</h3>}
          </div>
          {actions && <div className="flex items-center gap-2 ml-4">{actions}</div>}
        </div>
      )}
      <div style={bodyStyle} className={cn(padded && 'p-4')}>
        {children}
      </div>
    </div>
  );
}
