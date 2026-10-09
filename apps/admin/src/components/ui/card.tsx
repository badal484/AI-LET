import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-xl border border-border bg-surface', className)} {...p} />
);
export const CardHeader = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center justify-between gap-3 px-5 pt-4', className)} {...p} />
);
export const CardTitle = ({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-sm font-semibold text-text', className)} {...p} />
);
export const CardBody = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('px-5 pb-5 pt-3', className)} {...p} />;
