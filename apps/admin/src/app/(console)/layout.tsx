'use client';
import { useQuery } from '@tanstack/react-query';
import { LogOut, Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Sidebar } from '@/components/shell/Sidebar';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { LiveAdmin } from '@/components/shell/LiveAdmin';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { NAV, type AdminMe } from '@/lib/nav';

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['me'], queryFn: () => api<{ admin: AdminMe }>('/me') });
  const me = data?.admin;
  const page = NAV.find((n) => (n.href === '/' ? path === '/' : path.startsWith(n.href)));

  const logout = async () => {
    await fetch('/api/v1/admin/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
    window.location.href = '/login';
  };

  if (isLoading || !me) return <div className="min-h-screen" />;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-border bg-surface lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar me={me} />
        </div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 bg-surface">
            <Sidebar me={me} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-bg/80 px-4 backdrop-blur lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            {open ? <X size={18} /> : <Menu size={18} />}
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">{page?.label ?? 'Admin'}</h1>
          </div>
          <LiveAdmin />
          <span className="hidden text-sm text-muted md:inline">{me.email}</span>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out">
            <LogOut size={18} />
          </Button>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
