'use client';
import React, { useState } from 'react';
import { cn, truncHash, fmtUSD, fmtCompact } from '@/lib/utils';
import { Copy, ExternalLink, Check } from 'lucide-react';

/* =========================================================
   StatTile — big KPI tile with mono numerals
   ========================================================= */
export interface StatTileProps {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  delta?: React.ReactNode;
  deltaTone?: 'up' | 'down' | 'neutral';
  accent?: string;
  style?: React.CSSProperties;
}
const deltaCls = { up: 'text-[#5F7E5A]', down: 'text-[#A8483A]', neutral: 'text-[#756B5B]' };

export function StatTile({ label, value, sub, delta, deltaTone = 'neutral', accent, style }: StatTileProps) {
  return (
    <div style={style} className="bg-[#FBF7EE] border border-[#DDD3BE] rounded-md shadow-sm overflow-hidden">
      {accent && <div className="h-[3px]" style={{ background: accent }} />}
      <div className="px-4 py-3">
        <p className="type-label mb-2">{label}</p>
        <p className="font-mono text-[28px] font-medium tabular-nums text-ink leading-none">{value}</p>
        {(sub || delta) && (
          <div className="flex items-center gap-2 mt-1.5">
            {sub && <span className="text-[12px] text-[#756B5B]">{sub}</span>}
            {delta && <span className={cn('text-[12px] font-medium', deltaCls[deltaTone])}>{delta}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   HashChip — truncated mono hash with copy + explorer link
   ========================================================= */
export interface HashChipProps {
  value: string;
  label?: React.ReactNode;
  chars?: number;
  href?: string;
  tone?: 'info' | 'anchored' | 'neutral';
  style?: React.CSSProperties;
}
const chipBg  = { info: 'bg-[#DCE6F2] text-[#1B3D74]', anchored: 'bg-[#E2E8DA] text-[#3A5436]', neutral: 'bg-[#ECE2CE] text-[#756B5B]' };

export function HashChip({ value, label, chars = 6, href, tone = 'info', style }: HashChipProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  const chip = (
    <span style={style} className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-xs text-[12px] font-mono border border-black/10', chipBg[tone])}>
      {label && <span className="text-[10px] font-sans font-semibold uppercase tracking-wider opacity-60 mr-0.5">{label}</span>}
      <span className="tabular-nums">{truncHash(value, chars)}</span>
      <button onClick={copy} className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
      {href && <a href={href} target="_blank" rel="noopener" className="ml-0.5 opacity-50 hover:opacity-100"><ExternalLink size={11} /></a>}
    </span>
  );
  return chip;
}

/* =========================================================
   BudgetBar — budget vs. actual meter
   ========================================================= */
export interface BudgetBarProps {
  label: React.ReactNode;
  spent: number;
  budget: number;
  color?: string;
  showValues?: boolean;
  style?: React.CSSProperties;
}

export function BudgetBar({ label, spent, budget, color = 'var(--chart-1)', showValues = true, style }: BudgetBarProps) {
  const pct = Math.min((spent / budget) * 100, 100);
  const over = spent > budget;
  return (
    <div style={style} className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-ink-soft font-medium truncate mr-4">{label}</span>
        {showValues && (
          <span className={cn('text-[12px] font-mono tabular-nums flex-shrink-0', over ? 'text-[#A8483A]' : 'text-[#756B5B]')}>
            {fmtCompact(spent)} / {fmtCompact(budget)}
          </span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-[#ECE2CE] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-[320ms]"
          style={{ width: `${pct}%`, background: over ? '#A8483A' : color }} />
      </div>
      {over && (
        <p className="text-[11px] text-[#A8483A]">
          {(((spent - budget) / budget) * 100).toFixed(0)}% over allocation
        </p>
      )}
    </div>
  );
}

/* =========================================================
   Input — warm paper text field
   ========================================================= */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'style'> {
  icon?: React.ReactNode;
  mono?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
  wrapStyle?: React.CSSProperties;
}
const iSizes = { sm: 'h-7 px-3 text-xs', md: 'h-8 px-3 text-sm', lg: 'h-10 px-4 text-sm' };

export function Input({ icon, mono, size = 'md', style, wrapStyle, className, ...rest }: InputProps) {
  return (
    <div className="relative flex items-center" style={wrapStyle}>
      {icon && <span className="absolute left-2.5 text-[#756B5B] pointer-events-none">{icon}</span>}
      <input {...rest} style={style}
        className={cn(
          'w-full bg-[#FBF7EE] border border-[#DDD3BE] rounded-xs shadow-inset text-ink placeholder-[#9A8F7C] focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all duration-[120ms]',
          iSizes[size], icon && 'pl-8', mono && 'font-mono', className
        )} />
    </div>
  );
}
