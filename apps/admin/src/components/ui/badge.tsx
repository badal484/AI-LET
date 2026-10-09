import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const tones = {
  neutral: 'bg-surface-2 text-muted',
  good: 'bg-good/15 text-good',
  warn: 'bg-warn/15 text-warn',
  bad: 'bg-bad/15 text-bad',
  accent: 'bg-accent-soft text-accent',
};

export const Badge = ({ tone = 'neutral', className, ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) => (
  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tones[tone], className)} {...p} />
);

export const PlanBadge = ({ plan }: { plan: string }) =>
  plan === 'premium' ? <Badge tone="accent">Premium</Badge> : plan === 'trial' ? <Badge tone="warn">Trial</Badge> : <Badge>Free</Badge>;
