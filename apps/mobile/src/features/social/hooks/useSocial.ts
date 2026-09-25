import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SocialFeedTab, SocialProfileView, SocialReactionType } from '@ai-companion/types';
import { SocialApi } from '../api/socialApi.js';
import { SocialOfflineQueue } from '../state/socialClientState.js';

export const socialKeys = {
  features: ['social', 'features'] as const,
  me: ['social', 'me'] as const,
  privacy: ['social', 'privacy'] as const,
  consents: ['social', 'consents'] as const,
  enforcement: ['social', 'enforcement'] as const,
  profile: (handle: string) => ['social', 'profile', handle] as const,
  userContent: (handle: string) => ['social', 'userContent', handle] as const,
  feed: (tab: SocialFeedTab) => ['social', 'feed', tab] as const,
  content: (id: string) => ['social', 'content', id] as const,
  comments: (id: string) => ['social', 'comments', id] as const,
  threads: ['social', 'threads'] as const,
  messages: (threadId: string) => ['social', 'messages', threadId] as const,
  requests: ['social', 'messageRequests'] as const,
  community: (slug: string) => ['social', 'community', slug] as const,
  communityPosts: (slug: string) => ['social', 'communityPosts', slug] as const,
  blocks: ['social', 'blocks'] as const,
};

export const useSocialFeatures = () => useQuery({ queryKey: socialKeys.features, queryFn: SocialApi.features, staleTime: 60_000 });
export const useMySocialProfile = () => useQuery({ queryKey: socialKeys.me, queryFn: SocialApi.me, retry: false });
export const useSocialProfile = (handle: string) => useQuery({ queryKey: socialKeys.profile(handle), queryFn: () => SocialApi.profile(handle), retry: false });

export const useUserContent = (handle: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: socialKeys.userContent(handle),
    queryFn: ({ pageParam }) => SocialApi.userContent(handle, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });

export const useSocialFeed = (tab: SocialFeedTab) =>
  useInfiniteQuery({
    queryKey: socialKeys.feed(tab),
    queryFn: ({ pageParam }) => SocialApi.feed(tab, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Feeds are intentionally finite per session: no background refetch loops.
    staleTime: 60_000,
  });

export const useSharedContent = (publicId: string) => useQuery({ queryKey: socialKeys.content(publicId), queryFn: () => SocialApi.content(publicId), retry: false });

export const useComments = (publicId: string) =>
  useInfiniteQuery({
    queryKey: socialKeys.comments(publicId),
    queryFn: ({ pageParam }) => SocialApi.comments(publicId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const useThreads = () =>
  useInfiniteQuery({
    queryKey: socialKeys.threads,
    queryFn: ({ pageParam }) => SocialApi.threads(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const useMessages = (threadId: string) =>
  useInfiniteQuery({
    queryKey: socialKeys.messages(threadId),
    queryFn: ({ pageParam }) => SocialApi.messages(threadId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Short polling while the thread is open instead of a persistent socket.
    refetchInterval: 8_000,
  });

export const useMessageRequests = () => useQuery({ queryKey: socialKeys.requests, queryFn: () => SocialApi.messageRequests('incoming') });
export const useCommunity = (slug: string) => useQuery({ queryKey: socialKeys.community(slug), queryFn: () => SocialApi.community(slug), retry: false });
export const useCommunityPosts = (slug: string, enabled: boolean) =>
  useInfiniteQuery({
    queryKey: socialKeys.communityPosts(slug),
    queryFn: ({ pageParam }) => SocialApi.communityPosts(slug, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });

export const useSocialPrivacy = () => useQuery({ queryKey: socialKeys.privacy, queryFn: SocialApi.privacy });
export const useSocialConsents = () => useQuery({ queryKey: socialKeys.consents, queryFn: SocialApi.consents });
export const useEnforcement = () => useQuery({ queryKey: socialKeys.enforcement, queryFn: SocialApi.enforcement });

/** Optimistic follow toggle; network failures fall back to the idempotent offline queue. */
export function useFollowToggle(handle: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (next: 'follow' | 'unfollow') => SocialOfflineQueue.perform({ kind: next, target: handle }),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: socialKeys.profile(handle) });
      const prev = qc.getQueryData<SocialProfileView>(socialKeys.profile(handle));
      if (prev?.relationship) {
        qc.setQueryData<SocialProfileView>(socialKeys.profile(handle), {
          ...prev,
          relationship: { ...prev.relationship, following: next === 'follow' ? 'ACTIVE' : null },
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(socialKeys.profile(handle), ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: socialKeys.profile(handle) });
      qc.invalidateQueries({ queryKey: ['social', 'feed'] });
    },
  });
}

export function useReactionToggle(publicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, on }: { type: SocialReactionType; on: boolean }) =>
      SocialOfflineQueue.perform({ kind: on ? 'react' : 'unreact', publicId, reaction: type }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: socialKeys.content(publicId) });
    },
  });
}

/** Blocking immediately purges cached surfaces where the blocked person could still appear. */
export function useBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ target, reason }: { target: string; reason?: string }) => SocialApi.block(target, reason),
    onSuccess: () => {
      for (const key of [['social', 'feed'], ['social', 'profile'], ['social', 'comments'], socialKeys.threads, socialKeys.requests, socialKeys.blocks]) {
        qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
