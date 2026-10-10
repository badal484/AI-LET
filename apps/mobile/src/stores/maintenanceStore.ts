import { create } from 'zustand';

/** Maintenance mode (admin console → Settings → Maintenance), as the app shows it. Null = off. */
export interface MaintenanceInfo {
  title: string;
  message: string;
  emoji: string | null;
  imageUrl: string | null;
  /** When the team expects to be back (ISO), if they set it. */
  until: string | null;
  link: { label: string; url: string } | null;
}

export const useMaintenanceStore = create<{ info: MaintenanceInfo | null; set: (info: MaintenanceInfo | null) => void }>((set) => ({
  info: null,
  set: (info) => set({ info }),
}));

/** From a blocked request's error body ({ code: 'MAINTENANCE', maintenance }). */
export function noteMaintenanceError(error: unknown): void {
  const e = error as { code?: string; maintenance?: MaintenanceInfo } | null;
  if (e?.code === 'MAINTENANCE') useMaintenanceStore.getState().set(e.maintenance ?? { title: 'Lovira is getting better', message: '', emoji: '💜', imageUrl: null, until: null, link: null });
}
