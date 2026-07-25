import { z } from 'zod';
import { insertOrderSchema } from './schema';

export { type CreateOrderRequest, type AddToWatchlistRequest, type CreateTransactionRequest } from './schema';

export const api = {
  products: {
    list: { method: 'GET' as const, path: '/api/products' as const, responses: { 200: z.any() } },
    get: { method: 'GET' as const, path: '/api/products/:id' as const, responses: { 200: z.any(), 404: z.any() } },
  },
  orders: {
    list: { method: 'GET' as const, path: '/api/orders' as const, responses: { 200: z.any() } },
    create: {
      method: 'POST' as const, path: '/api/orders' as const,
      input: insertOrderSchema,
      responses: { 201: z.any(), 400: z.any() },
    },
  },
  positions: {
    list: { method: 'GET' as const, path: '/api/positions' as const, responses: { 200: z.any() } },
  },
  account: {
    get: { method: 'GET' as const, path: '/api/account' as const, responses: { 200: z.any() } },
  },
  watchlist: {
    list: { method: 'GET' as const, path: '/api/watchlist' as const, responses: { 200: z.any() } },
    add: { method: 'POST' as const, path: '/api/watchlist' as const, input: z.object({ productId: z.number() }), responses: { 201: z.any() } },
    remove: { method: 'DELETE' as const, path: '/api/watchlist/:productId' as const, responses: { 200: z.any() } },
  },
  transactions: {
    list: { method: 'GET' as const, path: '/api/transactions' as const, responses: { 200: z.any() } },
    create: { method: 'POST' as const, path: '/api/transactions' as const, responses: { 201: z.any() } },
  },
  chat: {
    conversations: { method: 'GET' as const, path: '/api/chat/conversations' as const, responses: { 200: z.any() } },
    createConversation: { method: 'POST' as const, path: '/api/chat/conversations' as const, responses: { 201: z.any() } },
    messages: { method: 'GET' as const, path: '/api/chat/conversations/:id/messages' as const, responses: { 200: z.any() } },
    sendMessage: { method: 'POST' as const, path: '/api/chat/conversations/:id/messages' as const, responses: { 201: z.any() } },
  },
  admin: {
    stats: { method: 'GET' as const, path: '/api/admin/stats' as const, responses: { 200: z.any() } },
    users: { method: 'GET' as const, path: '/api/admin/users' as const, responses: { 200: z.any() } },
    userDetail: { method: 'GET' as const, path: '/api/admin/users/:id' as const, responses: { 200: z.any() } },
    adjustBalance: { method: 'POST' as const, path: '/api/admin/users/:id/balance' as const, responses: { 200: z.any() } },
    transactions: { method: 'GET' as const, path: '/api/admin/transactions' as const, responses: { 200: z.any() } },
    updateTransaction: { method: 'PATCH' as const, path: '/api/admin/transactions/:id' as const, responses: { 200: z.any() } },
    orders: { method: 'GET' as const, path: '/api/admin/orders' as const, responses: { 200: z.any() } },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
