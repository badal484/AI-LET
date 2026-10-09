'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV, can, type AdminMe } from '@/lib/nav';
import { cn } from '@/lib/utils';

export function Sidebar({ me, onNavigate }: { me?: AdminMe; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <Link href="/" onClick={onNavigate} className="mb-4 flex items-center gap-2 px-2 pt-2">
        <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-accent to-accent-2" />
        <span className="text-lg font-bold tracking-tight">
          Lovira <span className="font-medium text-muted">admin</span>
        </span>
      </Link>
      {NAV.filter((n) => can(me, n.permission)).map((n) => {
        const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-text',
            )}
          >
            <n.icon size={18} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
