import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Product, Account, Order, Position, Transaction } from "@shared/schema";

export function useProducts() {
  return useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });
}

export function useProduct(id: number) {
  return useQuery<Product>({
    queryKey: ["/api/products", id],
    queryFn: async () => {
      const res = await fetch(`/api/products/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch product");
      return res.json();
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      productId: number;
      type: string;
      orderType?: string;
      lotSize: number;
      triggerPrice?: number | null;
      stopLoss?: number | null;
      takeProfit?: number | null;
    }) => {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to place order");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/open"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account"] });
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
    },
  });
}

export function useUpdateOrderSlTp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, stopLoss, takeProfit }: { orderId: number; stopLoss?: number | null; takeProfit?: number | null }) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stopLoss, takeProfit }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update SL/TP");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/open"] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: number) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to cancel order");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/open"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account"] });
    },
  });
}

export function useCloseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: number) => {
      const res = await fetch(`/api/orders/${orderId}/close`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to close order");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/open"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account"] });
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
    },
  });
}

export function useOrders() {
  return useQuery<(Order & { product: Product })[]>({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const res = await fetch("/api/orders", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
  });
}

export function useOpenOrders() {
  return useQuery<(Order & { product: Product })[]>({
    queryKey: ["/api/orders/open"],
    queryFn: async () => {
      const res = await fetch("/api/orders/open", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch open orders");
      return res.json();
    },
    refetchInterval: 5000,
  });
}

export function usePositions() {
  return useQuery<(Position & { product: Product })[]>({
    queryKey: ["/api/positions"],
    queryFn: async () => {
      const res = await fetch("/api/positions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch positions");
      return res.json();
    },
  });
}

export function useAccount() {
  return useQuery<{ account: Account; portfolioValue: number; totalPnL: number; equity: number; marginUsed: number; freeMargin: number; marginLevel: number; leverage: number } | null>({
    queryKey: ["/api/account"],
    queryFn: async () => {
      const res = await fetch("/api/account", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch account");
      return res.json();
    },
  });
}

export function useWatchlist() {
  return useQuery<Product[]>({
    queryKey: ["/api/watchlist"],
    queryFn: async () => {
      const res = await fetch("/api/watchlist", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch watchlist");
      return res.json();
    },
  });
}

export function useAddToWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { productId: number }) => {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add to watchlist");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] }),
  });
}

export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (productId: number) => {
      const res = await fetch(`/api/watchlist/${productId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove from watchlist");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] }),
  });
}

export function useTransactions() {
  return useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    queryFn: async () => {
      const res = await fetch("/api/transactions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { type: string; amount: number; note?: string }) => {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create transaction");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account"] });
    },
  });
}
