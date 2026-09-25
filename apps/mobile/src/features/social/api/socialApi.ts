import type {
  CharacterFollowState,
  CommunityMemberView,
  CommunityView,
  SocialCommentView,
  SocialConsentItem,
  SocialContentView,
  SocialCursorPage,
  SocialDirectMessageView,
  SocialEnforcementNotice,
  SocialFeatureAvailability,
  SocialFeedPage,
  SocialFeedTab,
  SocialMessageRequestView,
  SocialMuteItem,
  SocialMyProfile,
  SocialPrivacySettingsDto,
  SocialProfileView,
  SocialReactionType,
  SocialReportReceipt,
  SocialSharePreview,
  SocialThreadView,
  SocialUserCard,
  UsernameAvailability,
} from '@ai-companion/types';
import type {
  CreateCommunityInput,
  SocialCreatePostInput,
  SocialCreateShareInput,
  SocialFeedFeedbackInput,
  SocialMuteInput,
  SocialReportInput,
  SocialSharePreviewInput,
  UpdateSocialPrivacyInput,
} from '@ai-companion/validation';
import { ApiClient } from '../../../services/api/client.js';

type Envelope<T> = { success: boolean; data: T };

/** Every social mutation carries an Idempotency-Key; retries reuse the same key so they never double-apply. */
export function newIdempotencyKey(): string {
  const rnd = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `m-${Date.now().toString(36)}-${rnd}`;
}

async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await ApiClient.getInstance().get<Envelope<T>>(url, { params });
  return res.data.data;
}

async function mutate<T>(method: 'post' | 'put' | 'patch' | 'delete', url: string, body?: unknown, idempotencyKey = newIdempotencyKey()): Promise<T> {
  const headers = { 'Idempotency-Key': idempotencyKey };
  const client = ApiClient.getInstance();
  const res =
    method === 'delete'
      ? await client.delete<Envelope<T>>(url, { headers, data: body })
      : await client[method]<Envelope<T>>(url, body ?? {}, { headers });
  return res.data.data;
}

const enc = encodeURIComponent;

export const SocialApi = {
  // Identity, privacy, consent
  features: () => get<SocialFeatureAvailability>('/social/features'),
  me: () => get<SocialMyProfile>('/social/me'),
  createProfile: (input: { username: string; displayName: string; bio?: string }) => mutate<SocialMyProfile>('post', '/social/me', input),
  updateProfile: (input: { displayName?: string; bio?: string | null; pronouns?: string | null }) => mutate<SocialMyProfile>('patch', '/social/me', input),
  changeUsername: (username: string) => mutate<{ username: string }>('put', '/social/me/username', { username }),
  usernameAvailability: (username: string) => get<UsernameAvailability>(`/social/usernames/${enc(username)}/availability`),
  privacy: () => get<SocialPrivacySettingsDto>('/social/me/privacy'),
  updatePrivacy: (patch: UpdateSocialPrivacyInput) => mutate<SocialPrivacySettingsDto>('patch', '/social/me/privacy', patch),
  consents: () => get<SocialConsentItem[]>('/social/me/consents'),
  setConsent: (consentType: string, granted: boolean) => mutate<SocialConsentItem>('put', '/social/me/consents', { consentType, granted }),
  enforcement: () => get<SocialEnforcementNotice[]>('/social/me/enforcement'),
  appeal: (caseId: string, reason: string) => mutate<{ id: string; status: string }>('post', '/social/appeals', { caseId, reason }),

  // Profiles & graph
  profile: (handle: string) => get<SocialProfileView>(`/social/users/${enc(handle)}`),
  followers: (handle: string, cursor?: string) => get<SocialCursorPage<SocialUserCard>>(`/social/users/${enc(handle)}/followers`, { cursor }),
  following: (handle: string, cursor?: string) => get<SocialCursorPage<SocialUserCard>>(`/social/users/${enc(handle)}/following`, { cursor }),
  userContent: (handle: string, cursor?: string) => get<SocialCursorPage<SocialContentView>>(`/social/users/${enc(handle)}/content`, { cursor }),
  follow: (target: string, key?: string) => mutate<{ status: 'ACTIVE' | 'PENDING' }>('post', '/social/follows', { target }, key),
  unfollow: (handle: string, key?: string) => mutate<{ removed: boolean }>('delete', `/social/follows/${enc(handle)}`, undefined, key),
  followRequests: (cursor?: string) => get<SocialCursorPage<SocialUserCard>>('/social/follow-requests', { cursor }),
  respondFollowRequest: (target: string, action: 'ACCEPT' | 'DECLINE') => mutate<unknown>('post', '/social/follow-requests/respond', { target, action }),
  block: (target: string, reason?: string) => mutate<{ blocked: true }>('post', '/social/blocks', { target, reason }),
  unblock: (handle: string) => mutate<{ unblocked: boolean }>('delete', `/social/blocks/${enc(handle)}`),
  blocks: (cursor?: string) => get<SocialCursorPage<SocialUserCard>>('/social/blocks', { cursor }),
  mute: (input: SocialMuteInput) => mutate<SocialMuteItem>('post', '/social/mutes', input),
  unmute: (input: { targetType: SocialMuteInput['targetType']; target: string; scope?: SocialMuteInput['scope'] }) => mutate<{ removed: number }>('delete', '/social/mutes', input),
  mutes: () => get<SocialMuteItem[]>('/social/mutes'),
  characterFollowState: (slug: string) => get<CharacterFollowState>(`/social/characters/${enc(slug)}/follow`),
  followCharacter: (slug: string, notificationsEnabled: boolean, key?: string) => mutate<CharacterFollowState>('post', `/social/characters/${enc(slug)}/follow`, { notificationsEnabled }, key),
  unfollowCharacter: (slug: string, key?: string) => mutate<CharacterFollowState>('delete', `/social/characters/${enc(slug)}/follow`, undefined, key),
  search: (q: string, type: 'USERS' | 'COMMUNITIES' = 'USERS', cursor?: string) => get<SocialCursorPage<SocialUserCard | CommunityView>>('/social/search', { q, type, cursor }),

  // Content
  previewShare: (source: SocialSharePreviewInput) => ApiClient.getInstance().post<Envelope<SocialSharePreview>>('/social/shares/preview', source).then((r) => r.data.data),
  createShare: (input: SocialCreateShareInput) => mutate<SocialContentView>('post', '/social/shares', input),
  createPost: (input: SocialCreatePostInput) => mutate<SocialContentView>('post', '/social/posts', input),
  content: (publicId: string) => get<SocialContentView>(`/social/content/${enc(publicId)}`),
  revoke: (publicId: string) => mutate<{ revoked: boolean }>('post', `/social/content/${enc(publicId)}/revoke`),
  deleteContent: (publicId: string) => mutate<{ deleted: boolean }>('delete', `/social/content/${enc(publicId)}`),
  characterContent: (slug: string, cursor?: string) => get<SocialCursorPage<SocialContentView>>(`/social/characters/${enc(slug)}/content`, { cursor }),
  react: (publicId: string, type: SocialReactionType, key?: string) => mutate<{ reactionCount: number }>('put', `/social/content/${enc(publicId)}/reactions/${type}`, undefined, key),
  unreact: (publicId: string, type: SocialReactionType, key?: string) => mutate<{ reactionCount: number }>('delete', `/social/content/${enc(publicId)}/reactions/${type}`, undefined, key),
  comments: (publicId: string, cursor?: string, parentId?: string) => get<SocialCursorPage<SocialCommentView>>(`/social/content/${enc(publicId)}/comments`, { cursor, parentId }),
  comment: (publicId: string, body: string, parentId?: string) => mutate<SocialCommentView>('post', `/social/content/${enc(publicId)}/comments`, { body, parentId }),
  editComment: (id: string, body: string) => mutate<SocialCommentView>('patch', `/social/comments/${id}`, { body }),
  deleteComment: (id: string) => mutate<{ deleted: boolean }>('delete', `/social/comments/${id}`),
  report: (input: SocialReportInput) => mutate<SocialReportReceipt>('post', '/social/reports', input),

  // Feed
  feed: (tab: SocialFeedTab, cursor?: string) => get<SocialFeedPage>('/social/feed', { tab, cursor, limit: 20 }),
  feedFeedback: (input: SocialFeedFeedbackInput) => mutate<{ ok: true }>('post', '/social/feed/feedback', input),
  impressions: (items: Array<{ contentId: string; position: number }>) => ApiClient.getInstance().post('/social/feed/impressions', { items }).catch(() => undefined),

  // Messaging
  threads: (cursor?: string) => get<SocialCursorPage<SocialThreadView>>('/social/conversations', { cursor }),
  startConversation: (to: string, message: string, clientMessageId: string) => mutate<{ mode: 'DIRECT' | 'REQUEST'; threadId: string }>('post', '/social/conversations', { to, message, clientMessageId }, clientMessageId),
  messages: (threadId: string, cursor?: string) => get<SocialCursorPage<SocialDirectMessageView> & { counterpartTyping: boolean }>(`/social/conversations/${threadId}/messages`, { cursor }),
  send: (threadId: string, body: string, clientMessageId: string) => mutate<SocialDirectMessageView>('post', `/social/conversations/${threadId}/messages`, { body, clientMessageId }, clientMessageId),
  markRead: (threadId: string) => ApiClient.getInstance().post(`/social/conversations/${threadId}/read`),
  typing: (threadId: string) => ApiClient.getInstance().post(`/social/conversations/${threadId}/typing`).catch(() => undefined),
  messageRequests: (direction: 'incoming' | 'outgoing' = 'incoming') => get<SocialCursorPage<SocialMessageRequestView>>('/social/message-requests', { direction }),
  respondMessageRequest: (id: string, action: 'ACCEPT' | 'DECLINE' | 'BLOCK') => mutate<{ status: string; threadId: string | null }>('post', `/social/message-requests/${id}/respond`, { action }),
  unread: () => get<{ unread: number }>('/social/messages/unread-count'),

  // Communities
  community: (slug: string) => get<CommunityView>(`/social/communities/${enc(slug)}`),
  communityPosts: (slug: string, cursor?: string) => get<SocialCursorPage<SocialContentView>>(`/social/communities/${enc(slug)}/posts`, { cursor }),
  communityMembers: (slug: string, cursor?: string) => get<SocialCursorPage<CommunityMemberView>>(`/social/communities/${enc(slug)}/members`, { cursor }),
  joinCommunity: (slug: string) => mutate<CommunityView>('post', `/social/communities/${enc(slug)}/join`, { acceptRules: true }),
  leaveCommunity: (slug: string) => mutate<{ left: boolean }>('post', `/social/communities/${enc(slug)}/leave`),
  createCommunity: (input: CreateCommunityInput) => mutate<CommunityView>('post', '/social/communities', input),
};
