import { api } from './client.js';

export interface GiftItem {
  id: string;
  name: string;
  icon: string;
  coins: number;
}

/** Gifts cost coins, charged by the server (once per clientRequestId) before the gift message is sent. */
export const GiftsApi = {
  async list(conversationId: string): Promise<{ gifts: GiftItem[]; coins: number; charged: boolean }> {
    return (await api.get(`/conversations/${conversationId}/gifts`)).data.data;
  },
  async send(conversationId: string, giftId: string, clientRequestId: string): Promise<{ text: string; coins: number; charged: boolean }> {
    return (await api.post(`/conversations/${conversationId}/gifts`, { giftId, clientRequestId })).data.data;
  },
};
