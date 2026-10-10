import { useQuery } from '@tanstack/react-query';
import { ConversationApi } from '../api/conversationApi.js';
import { ApiClient } from '../api/client.js';
import { SecureAuthStorage } from '../auth/SecureAuthStorage.js';

/**
 * How many chats have unread messages (the number on the Chats tab, like WhatsApp). Shares the Chats
 * list's cache, so live updates and the list refresh it at the same time.
 */
export function useUnreadChats(): number {
  const { data } = useQuery({
    queryKey: ['conversations', 'list'],
    queryFn: async () => {
      const session = await SecureAuthStorage.getSession();
      if (session?.accessToken) ApiClient.setAuthToken(session.accessToken);
      return ConversationApi.listConversations({ limit: 50 });
    },
    retry: 1,
  });
  return (data?.items ?? []).filter((c) => (c.unreadCount ?? 0) > 0).length;
}
