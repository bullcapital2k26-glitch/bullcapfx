import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Product, Message } from "@shared/schema";

type PriceUpdate = { id: number; currentPrice: number; change24h: number; bid: number; ask: number; spread: number; decimals: number };
type PnlUpdate = {
  orderId: number;
  productId: number;
  symbol: string;
  unrealizedPnl: number;
  currentPrice: number;
  entryPrice: number;
  lotSize: number;
  type: string;
};
type PositionClosedEvent = {
  orderId: number;
  symbol: string;
  reason: string;
  pnl: number;
  closePrice: number;
};
type WsMessage =
  | { type: "price_update"; data: PriceUpdate[] }
  | { type: "chat_message"; data: Message }
  | { type: "pnl_update"; data: PnlUpdate[] }
  | { type: "position_closed"; data: PositionClosedEvent };

let globalWs: WebSocket | null = null;
let priceListeners: Set<(updates: PriceUpdate[]) => void> = new Set();
let chatListeners: Set<(msg: Message) => void> = new Set();
let pnlListeners: Set<(updates: PnlUpdate[]) => void> = new Set();
let positionClosedListeners: Set<(event: PositionClosedEvent) => void> = new Set();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function getWsUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

function connectWs() {
  if (globalWs && (globalWs.readyState === WebSocket.OPEN || globalWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  globalWs = new WebSocket(getWsUrl());

  globalWs.onmessage = (event) => {
    try {
      const msg: WsMessage = JSON.parse(event.data);
      if (msg.type === "price_update") {
        for (const listener of priceListeners) listener(msg.data);
      } else if (msg.type === "chat_message") {
        for (const listener of chatListeners) listener(msg.data);
      } else if (msg.type === "pnl_update") {
        for (const listener of pnlListeners) listener(msg.data);
      } else if (msg.type === "position_closed") {
        for (const listener of positionClosedListeners) listener(msg.data);
      }
    } catch {}
  };

  globalWs.onclose = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => connectWs(), 3000);
  };

  globalWs.onerror = () => {
    globalWs?.close();
  };
}

export function useRealtimePrices() {
  const queryClient = useQueryClient();
  const [priceMap, setPriceMap] = useState<Map<number, PriceUpdate>>(new Map());

  useEffect(() => {
    connectWs();

    const listener = (updates: PriceUpdate[]) => {
      setPriceMap(prev => {
        const newMap = new Map(prev);
        for (const u of updates) newMap.set(u.id, u);
        return newMap;
      });

      queryClient.setQueryData<Product[]>(["/api/products"], (old) => {
        if (!old) return old;
        return old.map(p => {
          const update = updates.find(u => u.id === p.id);
          if (update) return { ...p, currentPrice: update.currentPrice, change24h: update.change24h };
          return p;
        });
      });
    };

    priceListeners.add(listener);
    return () => { priceListeners.delete(listener); };
  }, [queryClient]);

  const getPrice = useCallback((productId: number) => priceMap.get(productId), [priceMap]);

  return { priceMap, getPrice };
}

export function useChatMessages(onMessage: (msg: Message) => void) {
  const cbRef = useRef(onMessage);
  cbRef.current = onMessage;

  useEffect(() => {
    connectWs();
    const listener = (msg: Message) => cbRef.current(msg);
    chatListeners.add(listener);
    return () => { chatListeners.delete(listener); };
  }, []);
}

export function usePnlUpdates() {
  const [pnlMap, setPnlMap] = useState<Map<number, PnlUpdate>>(new Map());

  useEffect(() => {
    connectWs();
    const listener = (updates: PnlUpdate[]) => {
      setPnlMap(prev => {
        const newMap = new Map(prev);
        for (const u of updates) newMap.set(u.orderId, u);
        return newMap;
      });
    };
    pnlListeners.add(listener);
    return () => { pnlListeners.delete(listener); };
  }, []);

  const getPnl = useCallback((orderId: number) => pnlMap.get(orderId), [pnlMap]);
  return { pnlMap, getPnl };
}

export function usePositionClosedEvents(onClosed: (event: PositionClosedEvent) => void) {
  const cbRef = useRef(onClosed);
  cbRef.current = onClosed;

  useEffect(() => {
    connectWs();
    const listener = (event: PositionClosedEvent) => cbRef.current(event);
    positionClosedListeners.add(listener);
    return () => { positionClosedListeners.delete(listener); };
  }, []);
}
