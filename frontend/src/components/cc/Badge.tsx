'use client';
// src/components/cc/Badge.tsx
import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps {
  children?: React.ReactNode;
  tone?: 'anchored' | 'pending' | 'spike' | 'info' | 'neutral';
  dot?: boolean;
  mono?: boolean;
  style?: React.CSSProperties;
}
const tones = {
  anchored: 'bg-[#E2E8DA] text-[#3A5436]',
  pending:  'bg-[#F0E6CF] text-[#7A5518]',
  spike:    'bg-[#F0DCD5] text-[#7A3228]',
  info:     'bg-[#DCE6F2] text-[#1B3D74]',
  neutral:  'bg-[#ECE2CE] text-[#756B5B]',
};
const dots = { anchored: 'bg-[#5F7E5A]', pending: 'bg-[#B8862B]', spike: 'bg-[#A8483A]', info: 'bg-blue-500', neutral: 'bg-muted' };

export function Badge({ children, tone = 'neutral', dot = true, mono, style }: BadgeProps) {
  return (
    <span style={style} className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-pill', tones[tone], mono && 'font-mono')}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dots[tone])} />}
      {children}
    </span>
  );
}
