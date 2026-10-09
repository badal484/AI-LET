import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Table = ({ className, ...p }: HTMLAttributes<HTMLTableElement>) => (
  <div className="overflow-x-auto">
    <table className={cn('w-full text-sm', className)} {...p} />
  </div>
);
export const Th = ({ className, ...p }: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn('whitespace-nowrap border-b border-border px-4 py-2.5 text-left text-xs font-medium text-muted', className)} {...p} />
);
export const Td = ({ className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('whitespace-nowrap border-b border-border px-4 py-3', className)} {...p} />
);
