'use client';
import { CampaignComposer } from '@/components/CampaignComposer';
import { emptyDraft } from '@/lib/campaigns';

export default function NewNotificationPage() {
  return <CampaignComposer initial={emptyDraft()} />;
}
