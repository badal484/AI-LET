import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  SocialCursorPage,
  SocialModerationCaseItem,
  SocialOverviewMetrics,
  SocialPolicyVersionItem,
  SocialSimulationResult,
} from '@ai-companion/types';
import type {
  AdminSocialCaseDecisionInput,
  AdminSocialSimulationInput,
} from '@ai-companion/validation';

const ADMIN_API_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:4000/api/v1';

async function adminRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_access_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };
  const response = await fetch(`${ADMIN_API_URL}${endpoint}`, { ...options, credentials: 'include', headers });
  const data = await response.json();
  if (!response.ok) {
    const errorData = (data as ApiErrorResponse)?.error;
    throw new Error(errorData?.message || `Request failed with status ${response.status}`);
  }
  return (data as ApiSuccessResponse<T>).data;
}

export interface SocialPolicySnapshot {
  version: number;
  config: Record<string, unknown> & {
    features: Record<string, { enabled: boolean; rolloutPercent: number; cohorts: string[] }>;
    killSwitches: Record<string, boolean>;
  };
}

export class AdminSocialApi {
  static overview(days = 7) {
    return adminRequest<SocialOverviewMetrics>(`/admin/social/overview?days=${days}`);
  }
  static graphHealth() {
    return adminRequest<Record<string, unknown>>('/admin/social/graph-health');
  }
  static policy() {
    return adminRequest<SocialPolicySnapshot>('/admin/social/policy');
  }
  static policyVersions() {
    return adminRequest<SocialPolicyVersionItem[]>('/admin/social/policy/versions');
  }
  static updatePolicy(patch: Record<string, unknown>, changeReason: string) {
    return adminRequest<SocialPolicyVersionItem>('/admin/social/policy', { method: 'PATCH', body: JSON.stringify({ patch, changeReason, confirm: true }) });
  }
  static rollback(toVersion: number, changeReason: string) {
    return adminRequest<SocialPolicyVersionItem>('/admin/social/policy/rollback', { method: 'POST', body: JSON.stringify({ toVersion, changeReason, confirm: true }) });
  }
  static setKillSwitch(feature: string, active: boolean, reason: string) {
    return adminRequest<SocialPolicyVersionItem>('/admin/social/kill-switches', { method: 'POST', body: JSON.stringify({ feature, active, reason, confirm: true }) });
  }
  static cases(queue?: string, cursor?: string) {
    const q = new URLSearchParams();
    if (queue) q.set('queue', queue);
    if (cursor) q.set('cursor', cursor);
    return adminRequest<SocialCursorPage<SocialModerationCaseItem>>(`/admin/social/cases?${q.toString()}`);
  }
  static caseDetail(id: string) {
    return adminRequest<{ case: SocialModerationCaseItem; target: Record<string, unknown> | null; reports: Array<{ id: string; reasonCode: string; details: string | null; createdAt: string }>; moderatorNotes: string | null }>(`/admin/social/cases/${id}`);
  }
  static decide(id: string, input: AdminSocialCaseDecisionInput) {
    return adminRequest<SocialModerationCaseItem>(`/admin/social/cases/${id}/decision`, { method: 'POST', body: JSON.stringify(input) });
  }
  static appeals() {
    return adminRequest<Array<{ id: string; status: string; reason: string; createdAt: string; case: SocialModerationCaseItem }>>('/admin/social/appeals');
  }
  static decideAppeal(id: string, decision: 'UPHOLD' | 'REVERSE', notes: string) {
    return adminRequest<{ id: string; status: string }>(`/admin/social/appeals/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision, notes }) });
  }
  static investigate(handle: string) {
    return adminRequest<Record<string, unknown> & { userId: string }>(`/admin/social/users/${encodeURIComponent(handle)}`);
  }
  static restrict(userId: string, type: string, reason: string, hours?: number) {
    return adminRequest<unknown>(`/admin/social/users/${userId}/restrictions`, { method: 'POST', body: JSON.stringify({ type, reason, hours, confirm: true }) });
  }
  static simulate(input: AdminSocialSimulationInput) {
    return adminRequest<SocialSimulationResult>('/admin/social/simulate', { method: 'POST', body: JSON.stringify(input) });
  }
  static actionLogs(actorType?: string) {
    return adminRequest<Array<Record<string, unknown>>>(`/admin/social/action-logs${actorType ? `?actorType=${actorType}` : ''}`);
  }
  static approveCharacter(slug: string, approved: boolean, reason: string) {
    return adminRequest<unknown>(`/admin/social/characters/${encodeURIComponent(slug)}/social-approval`, { method: 'POST', body: JSON.stringify({ approved, reason }) });
  }
}
