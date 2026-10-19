'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { NAV, can, type AdminMe, type NavItem } from '@/lib/nav';
import { cn } from '@/lib/utils';

/** Five main screens; the rest sit under "More" (opened automatically when you're on one of them). */
export function Sidebar({ me, onNavigate }: { me?: AdminMe; onNavigate?: () => void }) {
  const path = usePathname();
  const items = NAV.filter((n) => can(me, n.permission));
  const isActive = (n: NavItem) => (n.href === '/' ? path === '/' : path.startsWith(n.href));
  const more = items.filter((n) => n.more);
  const [open, setOpen] = useState(() => more.some(isActive));

  const link = (n: NavItem) => (
    <Link
      key={n.href}
      href={n.href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive(n) ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-text',
      )}
    >
      <n.icon size={18} />
      {n.label}
    </Link>
  );

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3">
      <Link href="/" onClick={onNavigate} className="mb-4 flex items-center gap-2 px-2 pt-2">
        <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-accent to-accent-2" />
        <span className="text-lg font-bold tracking-tight">
          Loveek <span className="font-medium text-muted">admin</span>
        </span>
      </Link>
      {items.filter((n) => !n.more).map(link)}
      {more.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted hover:text-text"
          >
            More
            <ChevronDown size={14} className={cn('ml-auto transition-transform', open && 'rotate-180')} />
          </button>
          {open && more.map(link)}
        </>
      )}
    </nav>
  );
}
