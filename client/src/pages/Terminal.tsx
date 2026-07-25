import { useState, useEffect, useCallback } from "react";
import { useProducts, useCreateOrder, useCloseOrder, useOpenOrders, useOrders, useAccount, useUpdateOrderSlTp, useCancelOrder } from "@/hooks/use-market";
import { useRealtimePrices, usePnlUpdates, usePositionClosedEvents } from "@/hooks/use-websocket";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2, X, ChevronDown, Edit2, Check } from "lucide-react";
import { getContractSize } from "@shared/schema";
import { calculatePnL } from "@shared/pipCalculator";
import { useCurrency } from "@/contexts/CurrencyContext";

const LOT_PRESETS = [0.01, 0.05, 0.1, 0.5, 1.0];
const ORDER_TYPES = [
  { value: "market", label: "Market" },
  { value: "buy_limit", label: "Buy Limit" },
  { value: "sell_limit", label: "Sell Limit" },
  { value: "buy_stop", label: "Buy Stop" },
  { value: "sell_stop", label: "Sell Stop" },
] as const;

export default function Terminal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: portfolio } = useAccount();
  const { data: openOrders } = useOpenOrders();
  const { data: allOrders } = useOrders();
  const { mutate: placeOrder, isPending: ordering } = useCreateOrder();
  const { mutate: closeOrder } = useCloseOrder();
  const { mutate: updateSlTp } = useUpdateOrderSlTp();
  const { mutate: cancelOrder } = useCancelOrder();
  const { getPrice } = useRealtimePrices();
  const { formatMoney } = useCurrency();
  const { getPnl } = usePnlUpdates();

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<string>("market");
  const [lotSize, setLotSize] = useState("0.01");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [activeTab, setActiveTab] = useState<"positions" | "pending" | "history">("positions");
  const [closingOrderId, setClosingOrderId] = useState<number | null>(null);
  const [editingOrder, setEditingOrder] = useState<number | null>(null);
  const [editSl, setEditSl] = useState("");
  const [editTp, setEditTp] = useState("");
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<any | null>(null);

  useEffect(() => {
    if (products && products.length > 0 && !selectedProductId) {
      const eurUsd = products.find(p => p.symbol === "EUR/USD");
      setSelectedProductId(eurUsd?.id || products[0].id);
    }
  }, [products, selectedProductId]);

  useEffect(() => {
    if (orderType !== "market") {
      if (orderType.startsWith("buy")) setSide("buy");
      else setSide("sell");
    }
  }, [orderType]);

  usePositionClosedEvents(useCallback((event) => {
    const reason = event.reason === "stop_loss" ? "Stop Loss" : event.reason === "take_profit" ? "Take Profit" : "Margin Call";
    toast({
      title: `Position Closed — ${event.symbol}`,
      description: `${reason} triggered. P&L: ${formatMoney(event.pnl)}`,
      variant: event.pnl >= 0 ? "default" : "destructive",
    });
    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/orders/open"] });
    queryClient.invalidateQueries({ queryKey: ["/api/account"] });
    queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
  }, [toast, queryClient]));

  const selectedProduct = products?.find(p => p.id === selectedProductId);
  const livePrice = selectedProduct ? getPrice(selectedProduct.id) : undefined;

  const serverBid = livePrice?.bid ?? 0;
  const serverAsk = livePrice?.ask ?? 0;
  const serverSpread = livePrice?.spread ?? 0;
  const serverDecimals = livePrice?.decimals ?? 5;
  const lots = parseFloat(lotSize) || 0;
  const contractSize = selectedProduct ? getContractSize(selectedProduct.symbol) : 100000;
  const units = lots * contractSize;
  const leverage = portfolio?.leverage || 100;
  const entryPrice = side === "buy" ? serverAsk : serverBid;
  const usdJpyProduct = products?.find(p => p.symbol === "USD/JPY");
  const usdJpyLive = usdJpyProduct ? getPrice(usdJpyProduct.id) : undefined;
  const usdJpyRate = usdJpyLive?.bid ?? 145;
  const symNorm = (selectedProduct?.symbol ?? "").toUpperCase().replace("/", "");
  const rawMargin = (entryPrice * units) / leverage;
  const marginRequired = symNorm.endsWith("JPY")
    ? rawMargin / usdJpyRate
    : symNorm.startsWith("USD") && symNorm.length > 3
    ? units / leverage
    : rawMargin;
  const balance = parseFloat(portfolio?.account.balance || "0");
  const equity = portfolio?.equity ?? balance;
  const marginUsed = portfolio?.marginUsed ?? 0;
  const freeMargin = portfolio?.freeMargin ?? balance;
  const marginLevel = portfolio?.marginLevel ?? Infinity;

  const handlePlaceOrder = () => {
    if (!selectedProductId || lots <= 0) return;

    const sl = parseFloat(stopLoss);
    const tp = parseFloat(takeProfit);
    const tp2 = parseFloat(triggerPrice);

    placeOrder({
      productId: selectedProductId,
      type: side,
      orderType: orderType,
      lotSize: lots,
      triggerPrice: orderType !== "market" && !isNaN(tp2) ? tp2 : null,
      stopLoss: isNaN(sl) ? null : sl,
      takeProfit: isNaN(tp) ? null : tp,
    }, {
      onSuccess: () => {
        const label = orderType === "market" ? `${side.toUpperCase()} ${lotSize} lot` : `${orderType.replace("_", " ").toUpperCase()} ${lotSize} lot`;
        toast({ title: "Order Placed", description: `${label} ${selectedProduct?.symbol} @ ${entryPrice.toFixed(serverDecimals)}` });
        setStopLoss("");
        setTakeProfit("");
        setTriggerPrice("");
      },
      onError: (err) => {
        toast({ title: "Order Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleCloseOrder = (orderId: number) => {
    setClosingOrderId(orderId);
    closeOrder(orderId, {
      onSuccess: (data: any) => {
        toast({
          title: "Position Closed",
          description: `P&L: ${formatMoney(data.pnl || 0)}`,
          variant: (data.pnl || 0) >= 0 ? "default" : "destructive",
        });
        setClosingOrderId(null);
      },
      onError: (err) => {
        toast({ title: "Close Failed", description: err.message, variant: "destructive" });
        setClosingOrderId(null);
      }
    });
  };

  const handleEditSlTp = (orderId: number) => {
    const sl = parseFloat(editSl);
    const tp = parseFloat(editTp);
    updateSlTp({
      orderId,
      stopLoss: isNaN(sl) ? null : sl,
      takeProfit: isNaN(tp) ? null : tp,
    }, {
      onSuccess: () => {
        toast({ title: "SL/TP Updated" });
        setEditingOrder(null);
      },
      onError: (err) => {
        toast({ title: "Update Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleCancelOrder = (orderId: number) => {
    cancelOrder(orderId, {
      onSuccess: () => {
        toast({ title: "Order Cancelled" });
      },
      onError: (err) => {
        toast({ title: "Cancel Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleSuggestSlTp = () => {
    if (!selectedProduct || serverBid === 0) return;
    const price = side === "buy" ? serverAsk : serverBid;
    let pips: number;
    const sym = selectedProduct.symbol;
    if (sym.includes("JPY") && sym.includes("/")) pips = 50 * 0.01;
    else if (sym === "XAU/USD") pips = 10;
    else if (sym === "XAG/USD") pips = 0.50;
    else if (sym === "WTI" || sym === "BRENT") pips = 1.0;
    else if (sym === "NATGAS") pips = 0.10;
    else if (sym.includes("/")) pips = 50 * 0.0001;
    else pips = price * 0.02;

    if (side === "buy") {
      setStopLoss((price - pips).toFixed(serverDecimals));
      setTakeProfit((price + pips).toFixed(serverDecimals));
    } else {
      setStopLoss((price + pips).toFixed(serverDecimals));
      setTakeProfit((price - pips).toFixed(serverDecimals));
    }
  };

  const closedOrders = allOrders?.filter(o => o.status === "closed") || [];
  const pendingOrders = allOrders?.filter(o => o.status === "pending") || [];

  if (productsLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="flex items-center justify-between px-2 sm:px-4 py-2 bg-card border-b border-white/5 shrink-0 gap-2">
        <div className="flex items-center gap-1 shrink-0">
          <a href="/" className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors shrink-0" data-testid="link-back">
            <X className="w-5 h-5" />
          </a>
          <button
            onClick={() => setShowSymbolPicker(!showSymbolPicker)}
            className="flex items-center gap-1 hover:bg-white/5 px-2 py-2 rounded-lg transition-colors"
            data-testid="button-symbol-picker"
          >
            <span className="font-bold text-base sm:text-lg" data-testid="text-selected-symbol">{selectedProduct?.symbol || "Select"}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
          <div className="hidden sm:flex gap-3 text-xs">
            <div data-testid="text-bid-price">
              <span className="text-muted-foreground mr-1">Bid</span>
              <span className="font-mono text-rose-400">{serverBid.toFixed(serverDecimals)}</span>
            </div>
            <div data-testid="text-ask-price">
              <span className="text-muted-foreground mr-1">Ask</span>
              <span className="font-mono text-emerald-400">{serverAsk.toFixed(serverDecimals)}</span>
            </div>
          </div>
        </div>
      </header>

      {showSymbolPicker && (
        <div className="absolute top-12 left-0 right-0 z-50 bg-card border-b border-white/10 shadow-2xl max-h-[60vh] overflow-y-auto" data-testid="symbol-picker-dropdown">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 p-3">
            {products?.map(p => {
              const live = getPrice(p.id);
              const price = live?.currentPrice || p.currentPrice;
              const change = live?.change24h ?? p.change24h ?? 0;
              const dec = live?.decimals ?? 5;
              return (
                <button
                  key={p.id}
                  onClick={() => { setSelectedProductId(p.id); setShowSymbolPicker(false); }}
                  className={cn(
                    "flex flex-col p-3 rounded-lg text-left transition-colors",
                    p.id === selectedProductId ? "bg-primary/10 border border-primary/30" : "hover:bg-white/5 border border-transparent"
                  )}
                  data-testid={`symbol-option-${p.id}`}
                >
                  <span className="font-bold text-sm">{p.symbol}</span>
                  <span className="text-[10px] text-muted-foreground">{p.name}</span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs font-mono">{price.toFixed(dec)}</span>
                    <span className={cn("text-[10px]", change >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 bg-card flex flex-col overflow-y-auto">
          <div className="p-3 border-b border-white/5 grid grid-cols-2 gap-2 text-xs">
            <div data-testid="text-terminal-balance">
              <span className="text-muted-foreground">Balance</span>
              <p className="font-bold font-mono">{formatMoney(balance)}</p>
            </div>
            <div data-testid="text-terminal-equity">
              <span className="text-muted-foreground">Equity</span>
              <p className={cn("font-bold font-mono", equity >= balance ? "text-emerald-400" : "text-rose-400")}>{formatMoney(equity)}</p>
            </div>
            <div data-testid="text-terminal-margin-used">
              <span className="text-muted-foreground">Margin Used</span>
              <p className="font-bold font-mono">{formatMoney(marginUsed)}</p>
            </div>
            <div data-testid="text-terminal-free-margin">
              <span className="text-muted-foreground">Free Margin</span>
              <p className="font-bold font-mono">{formatMoney(freeMargin)}</p>
            </div>
            <div className="col-span-2" data-testid="text-terminal-margin-level">
              <span className="text-muted-foreground">Margin Level</span>
              <p className={cn("font-bold font-mono", marginLevel > 200 ? "text-emerald-400" : marginLevel > 100 ? "text-primary" : "text-rose-400")}>
                {marginLevel === Infinity ? "∞" : `${marginLevel.toFixed(0)}%`}
              </p>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Order Type</label>
              <select
                value={orderType}
                onChange={e => setOrderType(e.target.value)}
                className="w-full bg-secondary/50 border border-white/10 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-primary"
                data-testid="select-order-type"
              >
                {ORDER_TYPES.map(ot => (
                  <option key={ot.value} value={ot.value}>{ot.label}</option>
                ))}
              </select>
            </div>

            {orderType === "market" && (
              <div className="grid grid-cols-2 gap-1 p-1 bg-secondary/50 rounded-lg">
                <button
                  onClick={() => setSide("buy")}
                  className={cn(
                    "py-2 rounded-md font-bold text-sm transition-all",
                    side === "buy" ? "bg-emerald-500 text-white" : "text-muted-foreground hover:text-white"
                  )}
                  data-testid="button-side-buy"
                >
                  BUY
                </button>
                <button
                  onClick={() => setSide("sell")}
                  className={cn(
                    "py-2 rounded-md font-bold text-sm transition-all",
                    side === "sell" ? "bg-rose-500 text-white" : "text-muted-foreground hover:text-white"
                  )}
                  data-testid="button-side-sell"
                >
                  SELL
                </button>
              </div>
            )}

            {orderType !== "market" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Trigger Price</label>
                <input
                  type="number"
                  step="any"
                  placeholder="Enter trigger price"
                  value={triggerPrice}
                  onChange={e => setTriggerPrice(e.target.value)}
                  className="w-full bg-secondary/50 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                  data-testid="input-trigger-price"
                />
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Lot Size</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={lotSize}
                onChange={e => setLotSize(e.target.value)}
                className="w-full bg-secondary/50 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                data-testid="input-lot-size"
              />
              <div className="flex gap-1 mt-2">
                {LOT_PRESETS.map(preset => (
                  <button
                    key={preset}
                    onClick={() => setLotSize(preset.toString())}
                    className={cn(
                      "flex-1 py-1 text-[10px] font-bold rounded transition-colors",
                      parseFloat(lotSize) === preset
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-secondary/50 text-muted-foreground hover:text-white border border-transparent"
                    )}
                    data-testid={`button-lot-${preset}`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Stop Loss</label>
                <input
                  type="number"
                  step="any"
                  placeholder="Optional"
                  value={stopLoss}
                  onChange={e => setStopLoss(e.target.value)}
                  className="w-full bg-secondary/50 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-rose-500"
                  data-testid="input-stop-loss"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Take Profit</label>
                <input
                  type="number"
                  step="any"
                  placeholder="Optional"
                  value={takeProfit}
                  onChange={e => setTakeProfit(e.target.value)}
                  className="w-full bg-secondary/50 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-emerald-500"
                  data-testid="input-take-profit"
                />
              </div>
            </div>

            <button
              onClick={handleSuggestSlTp}
              className="w-full py-1.5 text-xs text-muted-foreground hover:text-primary bg-secondary/30 rounded-lg transition-colors border border-white/5"
              data-testid="button-suggest-sltp"
            >
              Auto-suggest SL/TP
            </button>

            <div className="space-y-1 text-xs text-muted-foreground py-2 border-t border-white/5">
              <div className="flex justify-between">
                <span>Entry Price</span>
                <span className="font-mono">{entryPrice.toFixed(serverDecimals)}</span>
              </div>
              <div className="flex justify-between">
                <span>Volume</span>
                <span className="font-mono">{units.toLocaleString()} units</span>
              </div>
              <div className="flex justify-between">
                <span>Margin Req.</span>
                <span className="font-mono">{formatMoney(marginRequired)}</span>
              </div>
              <div className="flex justify-between">
                <span>Leverage</span>
                <span className="font-mono">1:{leverage}</span>
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={ordering || lots <= 0}
              className={cn(
                "w-full py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2",
                side === "buy"
                  ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                  : "bg-rose-500 hover:bg-rose-400 text-white",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              data-testid="button-execute-order"
            >
              {ordering ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                orderType === "market"
                  ? `${side.toUpperCase()} ${lotSize} LOT ${entryPrice.toFixed(serverDecimals)}`
                  : `${orderType.replace("_", " ").toUpperCase()} ${lotSize} LOT`
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="h-[240px] bg-card border-t border-white/5 flex flex-col shrink-0">
        <div className="flex border-b border-white/5">
          {(["positions", "pending", "history"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors relative",
                activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-white"
              )}
              data-testid={`tab-${tab}`}
            >
              {tab === "positions" ? `Open Positions ${openOrders?.length ? `(${openOrders.length})` : ""}` :
               tab === "pending" ? `Pending ${pendingOrders.length ? `(${pendingOrders.length})` : ""}` :
               "Trade History"}
              {activeTab === tab && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {activeTab === "positions" ? (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="text-muted-foreground border-b border-white/5">
                  <th className="text-left p-2 font-medium">Symbol</th>
                  <th className="text-left p-2 font-medium">Type</th>
                  <th className="text-right p-2 font-medium">Lots</th>
                  <th className="text-right p-2 font-medium">Entry</th>
                  <th className="text-right p-2 font-medium">SL</th>
                  <th className="text-right p-2 font-medium">TP</th>
                  <th className="text-right p-2 font-medium">P&L</th>
                  <th className="text-center p-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {(!openOrders || openOrders.length === 0) ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted-foreground">No open positions</td>
                  </tr>
                ) : (
                  openOrders.map(order => {
                    const pnlData = getPnl(order.id);
                    const live = getPrice(order.productId);
                    const dec = live?.decimals ?? serverDecimals;
                    const uPnl = pnlData?.unrealizedPnl ?? (() => {
                      const cp = order.type === "buy" ? (live?.bid ?? order.price) : (live?.ask ?? order.price);
                      return calculatePnL(order.product.symbol, order.type, order.price, cp, order.lotSize);
                    })();
                    const isEditing = editingOrder === order.id;
                    return (
                      <tr key={order.id} className="border-b border-white/5 hover:bg-white/[0.02]" data-testid={`open-order-${order.id}`}>
                        <td className="p-2 font-bold">{order.product.symbol}</td>
                        <td className={cn("p-2 font-bold", order.type === "buy" ? "text-emerald-400" : "text-rose-400")}>
                          {order.type.toUpperCase()}
                        </td>
                        <td className="p-2 text-right font-mono">{order.lotSize}</td>
                        <td className="p-2 text-right font-mono">{order.price.toFixed(dec)}</td>
                        <td className="p-2 text-right font-mono">
                          {isEditing ? (
                            <input type="number" step="any" value={editSl} onChange={e => setEditSl(e.target.value)}
                              className="w-16 bg-secondary/50 border border-white/10 rounded px-1 py-0.5 text-[10px] font-mono" />
                          ) : (
                            <span className="text-rose-400/70">{order.stopLoss?.toFixed(dec) || "—"}</span>
                          )}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {isEditing ? (
                            <input type="number" step="any" value={editTp} onChange={e => setEditTp(e.target.value)}
                              className="w-16 bg-secondary/50 border border-white/10 rounded px-1 py-0.5 text-[10px] font-mono" />
                          ) : (
                            <span className="text-emerald-400/70">{order.takeProfit?.toFixed(dec) || "—"}</span>
                          )}
                        </td>
                        <td className={cn("p-2 text-right font-mono font-bold", uPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                          {uPnl >= 0 ? "+" : ""}{formatMoney(uPnl)}
                        </td>
                        <td className="p-2 text-center flex gap-1 justify-center">
                          {isEditing ? (
                            <>
                              <button onClick={() => handleEditSlTp(order.id)} className="px-1 py-0.5 bg-emerald-500/20 rounded text-[10px] font-bold text-emerald-400" data-testid={`button-save-sltp-${order.id}`}>
                                <Check className="w-3 h-3" />
                              </button>
                              <button onClick={() => setEditingOrder(null)} className="px-1 py-0.5 bg-white/5 rounded text-[10px] text-muted-foreground">
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => { setEditingOrder(order.id); setEditSl(order.stopLoss?.toString() || ""); setEditTp(order.takeProfit?.toString() || ""); }}
                                className="px-1 py-0.5 bg-white/5 hover:bg-white/10 rounded text-[10px] text-muted-foreground hover:text-white"
                                data-testid={`button-edit-sltp-${order.id}`}
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleCloseOrder(order.id)}
                                disabled={closingOrderId === order.id}
                                className="px-2 py-0.5 bg-white/5 hover:bg-white/10 rounded text-[10px] font-bold text-muted-foreground hover:text-white transition-colors disabled:opacity-50"
                                data-testid={`button-close-order-${order.id}`}
                              >
                                {closingOrderId === order.id ? "..." : "CLOSE"}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : activeTab === "pending" ? (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="text-muted-foreground border-b border-white/5">
                  <th className="text-left p-2 font-medium">Symbol</th>
                  <th className="text-left p-2 font-medium">Type</th>
                  <th className="text-right p-2 font-medium">Lots</th>
                  <th className="text-right p-2 font-medium">Trigger</th>
                  <th className="text-right p-2 font-medium">SL</th>
                  <th className="text-right p-2 font-medium">TP</th>
                  <th className="text-center p-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">No pending orders</td>
                  </tr>
                ) : (
                  pendingOrders.map(order => {
                    const live = getPrice(order.productId);
                    const dec = live?.decimals ?? serverDecimals;
                    return (
                      <tr key={order.id} className="border-b border-white/5 hover:bg-white/[0.02]" data-testid={`pending-order-${order.id}`}>
                        <td className="p-2 font-bold">{order.product.symbol}</td>
                        <td className="p-2 font-bold text-primary text-[10px]">
                          {(order.orderType || "").replace("_", " ").toUpperCase()}
                        </td>
                        <td className="p-2 text-right font-mono">{order.lotSize}</td>
                        <td className="p-2 text-right font-mono text-primary">{order.triggerPrice?.toFixed(dec) || "—"}</td>
                        <td className="p-2 text-right font-mono text-rose-400/70">{order.stopLoss?.toFixed(dec) || "—"}</td>
                        <td className="p-2 text-right font-mono text-emerald-400/70">{order.takeProfit?.toFixed(dec) || "—"}</td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 rounded text-[10px] font-bold text-rose-400 transition-colors"
                            data-testid={`button-cancel-order-${order.id}`}
                          >
                            CANCEL
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="text-muted-foreground border-b border-white/5">
                  <th className="text-left p-2 font-medium">Symbol</th>
                  <th className="text-left p-2 font-medium">Type</th>
                  <th className="text-right p-2 font-medium">Lots</th>
                  <th className="text-right p-2 font-medium">Entry</th>
                  <th className="text-right p-2 font-medium">Close</th>
                  <th className="text-right p-2 font-medium">P&L</th>
                  <th className="text-right p-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {closedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">No trade history</td>
                  </tr>
                ) : (
                  closedOrders.map(order => {
                    const live = getPrice(order.productId);
                    const dec = live?.decimals ?? serverDecimals;
                    return (
                      <tr
                        key={order.id}
                        className="border-b border-white/5 hover:bg-primary/5 cursor-pointer"
                        onClick={() => setSelectedHistoryOrder({ ...order, dec })}
                        data-testid={`closed-order-${order.id}`}
                      >
                        <td className="p-2 font-bold">{order.product.symbol}</td>
                        <td className={cn("p-2 font-bold", order.type === "buy" ? "text-emerald-400" : "text-rose-400")}>
                          {order.type.toUpperCase()}
                        </td>
                        <td className="p-2 text-right font-mono">{order.lotSize}</td>
                        <td className="p-2 text-right font-mono">{order.price.toFixed(dec)}</td>
                        <td className="p-2 text-right font-mono">{order.closePrice != null ? Number(order.closePrice).toFixed(dec) : "—"}</td>
                        <td className={cn("p-2 text-right font-mono font-bold", (order.pnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                          {(order.pnl || 0) >= 0 ? "+" : ""}{formatMoney(order.pnl || 0)}
                        </td>
                        <td className="p-2 text-right text-muted-foreground">
                          {order.closedAt ? new Date(order.closedAt).toLocaleDateString() : order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedHistoryOrder && (() => {
        const o = selectedHistoryOrder;
        const dec = o.dec ?? 5;
        const pnl = Number(o.pnl || 0);
        const openTime = o.createdAt ? new Date(o.createdAt) : null;
        const closeTime = o.closedAt ? new Date(o.closedAt) : null;
        const durationMs = openTime && closeTime ? closeTime.getTime() - openTime.getTime() : null;
        const durationStr = durationMs != null
          ? durationMs < 60000
            ? `${Math.round(durationMs / 1000)}s`
            : durationMs < 3600000
            ? `${Math.round(durationMs / 60000)}m`
            : `${(durationMs / 3600000).toFixed(1)}h`
          : "—";
        return (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedHistoryOrder(null)}
          >
            <div
              className="bg-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base">{o.product?.symbol}</span>
                  <span className={cn("text-xs font-bold px-2 py-0.5 rounded", o.type === "buy" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400")}>
                    {o.type?.toUpperCase()}
                  </span>
                </div>
                <button onClick={() => setSelectedHistoryOrder(null)} className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lot Size</span>
                  <span className="font-mono font-medium">{o.lotSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entry Price</span>
                  <span className="font-mono">{Number(o.price).toFixed(dec)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Close Price</span>
                  <span className="font-mono">{o.closePrice != null ? Number(o.closePrice).toFixed(dec) : "—"}</span>
                </div>
                {o.stopLoss != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stop Loss</span>
                    <span className="font-mono text-rose-400">{Number(o.stopLoss).toFixed(dec)}</span>
                  </div>
                )}
                {o.takeProfit != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Take Profit</span>
                    <span className="font-mono text-emerald-400">{Number(o.takeProfit).toFixed(dec)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-white/5 pt-3">
                  <span className="text-muted-foreground">Realized P&L</span>
                  <span className={cn("font-mono font-bold text-base", pnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {pnl >= 0 ? "+" : ""}{formatMoney(pnl)}
                  </span>
                </div>
                <div className="border-t border-white/5 pt-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Opened</span>
                    <span className="font-mono">{openTime ? `${openTime.toLocaleDateString()} ${openTime.toLocaleTimeString()}` : "—"}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Closed</span>
                    <span className="font-mono">{closeTime ? `${closeTime.toLocaleDateString()} ${closeTime.toLocaleTimeString()}` : "—"}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-mono">{durationStr}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
