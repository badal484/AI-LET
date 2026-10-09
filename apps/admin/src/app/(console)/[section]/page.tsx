'use client';
import { notFound, useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { NAV } from '@/lib/nav';

/** Screens that are planned but not built yet. Each is replaced by its own page as it's built. */
export default function ComingSoon() {
  const { section } = useParams<{ section: string }>();
  const item = NAV.find((n) => n.href === `/${section}`);
  if (!item) notFound();
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <item.icon size={32} className="text-accent" />
      <h2 className="text-lg font-semibold">{item.label}</h2>
      <p className="max-w-md text-sm text-muted">{item.blurb}. This screen is next on the build list.</p>
    </Card>
  );
}
