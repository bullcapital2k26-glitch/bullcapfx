import { useState, useMemo } from "react";
import { useProduct, useCreateOrder, useAccount } from "@/hooks/use-market";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimePrices } from "@/hooks/use-websocket";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getContractSize } from "@shared/schema";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useCurrency } from "@/contexts/CurrencyContext";

export default function Trade() {
  const [match, params] = useRoute("/trade/:id");
  const productId = parseInt(params?.id || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: product, isLoading: productLoading } = useProduct(productId);
  const { data: portfolio } = useAccount();
  const { mutate: placeOrder, isPending: ordering } = useCreateOrder();
  const { getPrice } = useRealtimePrices();
  const { formatMoney } = useCurrency();

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [lotSize, setLotSize] = useState("0.01");

  const livePrice = getPrice(productId);
  const currentPrice = livePrice?.currentPrice || product?.currentPrice || 0;
  const currentChange = livePrice?.change24h ?? product?.change24h ?? 0;

  const chartData = useMemo(() => {
    if (!product) return [];
    const basePrice = product.currentPrice;
    return Array.from({ length: 24 }).map((_, i) => ({
      time: `${i}:00`,
      price: basePrice * (1 + (Math.random() * 0.05 - 0.025))
    }));
  }, [product]);

  if (productLoading || !product) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const lots = parseFloat(lotSize) || 0;
  const units = lots * getContractSize(product?.symbol ?? "");
  const notional = currentPrice * units;
  const balance = parseFloat(portfolio?.account.balance || "0");

  const handleOrder = () => {
    if (lots <= 0) return;
    placeOrder({
      productId,
      type: side,
      lotSize: lots,
    }, {
      onSuccess: () => {
        toast({ title: "Order Placed!", description: `${side.toUpperCase()} ${lotSize} lot ${product.symbol} executed.` });
        setLocation("/positions");
      },
      onError: (err) => {
        toast({ title: "Order Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const isPositive = currentChange >= 0;

  return (
    <div className="min-h-screen bg-background pb-20 flex flex-col">
      <header className="px-4 py-4 flex items-center gap-4 bg-background/50 backdrop-blur-md sticky top-0 z-20 border-b border-white/5">
        <button onClick={() => setLocation("/markets")} className="p-2 hover:bg-white/10 rounded-full" data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-lg" data-testid="text-symbol">{product.symbol}</h1>
          <p className="text-xs text-muted-foreground">{product.name}</p>
        </div>
        <button
          onClick={() => setLocation("/terminal")}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
          data-testid="button-open-terminal"
        >
          <Monitor className="w-3 h-3" />
          Terminal
        </button>
        <div className="text-right">
          <p className="font-mono font-bold" data-testid="text-price">{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })}</p>
          <div className={cn("text-xs flex items-center justify-end gap-1", isPositive ? "text-emerald-400" : "text-rose-400")} data-testid="text-change">
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(currentChange).toFixed(2)}%
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="h-[300px] w-full py-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isPositive ? "#10b981" : "#f43f5e"} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={isPositive ? "#10b981" : "#f43f5e"} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="time" hide />
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
              <Area type="monotone" dataKey="price" stroke={isPositive ? "#10b981" : "#f43f5e"} strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="px-6 py-6 bg-card rounded-t-3xl border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex-1 min-h-[400px]">
          <div className="grid grid-cols-2 gap-2 p-1 bg-secondary/50 rounded-xl mb-8">
            <button
              onClick={() => setSide("buy")}
              className={cn(
                "py-3 rounded-lg font-bold text-sm transition-all",
                side === "buy" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-muted-foreground hover:text-white"
              )}
              data-testid="button-buy"
            >
              Buy
            </button>
            <button
              onClick={() => setSide("sell")}
              className={cn(
                "py-3 rounded-lg font-bold text-sm transition-all",
                side === "sell" ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : "text-muted-foreground hover:text-white"
              )}
              data-testid="button-sell"
            >
              Sell
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Lot Size</label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setLotSize(Math.max(0.01, lots - 0.01).toFixed(2))}
                  className="w-12 h-12 rounded-xl bg-secondary hover:bg-secondary/80 flex items-center justify-center text-xl font-bold"
                  data-testid="button-lot-minus"
                >-</button>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={lotSize}
                  onChange={(e) => setLotSize(e.target.value)}
                  className="flex-1 bg-transparent border-b-2 border-white/10 text-center text-3xl font-display font-bold focus:outline-none focus:border-primary py-2"
                  data-testid="input-lot-size"
                />
                <button
                  onClick={() => setLotSize((lots + 0.01).toFixed(2))}
                  className="w-12 h-12 rounded-xl bg-secondary hover:bg-secondary/80 flex items-center justify-center text-xl font-bold"
                  data-testid="button-lot-plus"
                >+</button>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-1">{units.toLocaleString()} units</p>
            </div>

            <div className="space-y-2 py-4 border-t border-white/5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Notional Value</span>
                <span className="font-bold" data-testid="text-total">{formatMoney(notional)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Available Balance</span>
                <span className="font-mono" data-testid="text-balance">{formatMoney(balance)}</span>
              </div>
            </div>

            <button
              onClick={handleOrder}
              disabled={ordering || lots <= 0}
              className={cn(
                "w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2",
                side === "buy"
                  ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/25"
                  : "bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/25",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              data-testid="button-place-order"
            >
              {ordering ? <Loader2 className="animate-spin" /> : `Place ${side === "buy" ? "Buy" : "Sell"} Order`}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              For advanced SL/TP settings, use the{" "}
              <button onClick={() => setLocation("/terminal")} className="text-primary font-bold hover:underline">Trading Terminal</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
