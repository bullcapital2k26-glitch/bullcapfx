import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Order, Product, User } from "@shared/schema";
import { formatUSD } from "@/lib/currency";

export default function AdminOrders() {
  const { data: orders, isLoading } = useQuery<(Order & { product: Product; user?: User })[]>({
    queryKey: ["/api/admin/orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/orders", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  return (
    <AdminLayout>
      <h1 className="text-2xl font-display font-bold mb-6" data-testid="text-admin-orders">Orders</h1>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
      ) : orders?.length === 0 ? (
        <p className="text-center py-10 text-muted-foreground">No orders yet</p>
      ) : (
        <div className="space-y-3">
          {orders?.map(order => (
            <div key={order.id} className="bg-card p-4 rounded-xl border border-white/5" data-testid={`admin-order-${order.id}`}>
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                  order.type === "buy" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                )}>
                  {order.type === "buy" ? "B" : "S"}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm">{order.product?.symbol} — <span className={order.type === "buy" ? "text-emerald-400" : "text-rose-400"}>{order.type.toUpperCase()}</span></h4>
                  <p className="text-xs text-muted-foreground truncate">{order.user?.email || order.userId}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{order.lotSize} lot</p>
                  <p className="text-xs text-muted-foreground">@ {order.price.toLocaleString(undefined, { maximumFractionDigits: 5 })}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className={cn("text-[10px] px-2 py-0.5 rounded font-bold",
                  order.status === "open" ? "bg-amber-500/10 text-amber-400" : "bg-white/5 text-muted-foreground"
                )}>
                  {order.status.toUpperCase()}
                </span>
                {order.stopLoss && <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400">SL: {order.stopLoss}</span>}
                {order.takeProfit && <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">TP: {order.takeProfit}</span>}
                {order.pnl !== null && order.pnl !== undefined && (
                  <span className={cn("text-[10px] px-2 py-0.5 rounded font-bold",
                    order.pnl >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                  )}>
                    P&L: {formatUSD(order.pnl)}
                  </span>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground mt-2">
                {order.createdAt ? new Date(order.createdAt).toLocaleString() : ''}
                {order.closedAt ? ` · Closed: ${new Date(order.closedAt).toLocaleString()}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
