import { useOpenOrders, useCloseOrder } from "@/hooks/use-market";
import { useRealtimePrices, usePnlUpdates } from "@/hooks/use-websocket";
import { BottomNav } from "@/components/Navigation";
import { ArrowUpRight, ArrowDownRight, PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { getContractSize } from "@shared/schema";
import { calculatePnL as calcPnL } from "@shared/pipCalculator";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function Positions() {
  const { data: openOrders, isLoading } = useOpenOrders();
  const [, setLocation] = useLocation();
  const { getPrice } = useRealtimePrices();
  const { getPnl } = usePnlUpdates();
  const { mutate: closeOrder } = useCloseOrder();
  const { toast } = useToast();
  const { formatMoney } = useCurrency();

  const calculatePnL = (order: any) => {
    const pnlData = getPnl(order.id);
    const livePrice = getPrice(order.productId);
    const price = pnlData?.currentPrice || livePrice?.currentPrice || order.product.currentPrice;
    const units = order.lotSize * getContractSize(order.product?.symbol ?? "");
    const pnl = pnlData?.unrealizedPnl ??
      calcPnL(order.product.symbol, order.type, order.price, price, order.lotSize);
    const costBasis = order.price * units;
    const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
    return { pnl, pnlPercent, currentPrice: price };
  };

  const handleClose = (orderId: number) => {
    closeOrder(orderId, {
      onSuccess: (data: any) => {
        toast({ title: "Position Closed", description: `P&L: ${formatMoney(data.pnl || 0)}` });
      },
      onError: (err) => {
        toast({ title: "Close Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-6 pt-12 pb-6">
        <h1 className="text-2xl font-display font-bold text-center mb-6">Order Book</h1>
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Open Positions</h3>
          <button
            onClick={() => setLocation("/terminal")}
            className="px-6 py-2 bg-primary hover:bg-primary/80 text-white text-sm font-bold rounded-full transition-all"
            data-testid="link-open-terminal"
          >
            Open Terminal
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">Loading positions...</div>
        ) : !openOrders || openOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground border border-dashed border-white/10 rounded-2xl bg-white/5" data-testid="empty-positions">
            <PackageOpen className="w-12 h-12 mb-4 opacity-50" />
            <p>No open positions.</p>
            <button onClick={() => setLocation("/terminal")} className="mt-4 text-primary text-sm font-bold hover:underline" data-testid="link-start-trading">
              Start Trading
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full">
            {openOrders.map(order => {
              const { pnl, pnlPercent, currentPrice } = calculatePnL(order);
              const isProfit = pnl >= 0;
              return (
                <div
                  key={order.id}
                  className="bg-card p-5 rounded-2xl border border-white/5 shadow-lg"
                  data-testid={`position-card-${order.id}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                        order.type === "buy" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                      )}>
                        {order.type === "buy" ? "B" : "S"}
                      </div>
                      <div>
                        <h4 className="font-bold">{order.product.symbol}</h4>
                        <p className="text-xs text-muted-foreground">{order.lotSize} lot · {order.type.toUpperCase()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-sm">{currentPrice.toLocaleString(undefined, { maximumFractionDigits: 5 })}</p>
                      <p className="text-[10px] text-muted-foreground">Entry: {order.price.toLocaleString(undefined, { maximumFractionDigits: 5 })}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-3">
                    {order.stopLoss && <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400">SL: {order.stopLoss}</span>}
                    {order.takeProfit && <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">TP: {order.takeProfit}</span>}
                  </div>

                  <div className="pt-3 border-t border-white/5 flex flex-col items-center gap-2">
                    <div className={cn("flex items-center gap-1 font-bold text-xl", isProfit ? "text-emerald-400" : "text-rose-400")}>
                      {isProfit ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                      {formatMoney(Math.abs(pnl))}
                      <span className="text-sm font-medium opacity-70">({Math.abs(pnlPercent).toFixed(2)}%)</span>
                    </div>
                    <button
                      onClick={() => handleClose(order.id)}
                      className="px-3 py-1 text-xs font-bold rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                      data-testid={`button-close-position-${order.id}`}
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
