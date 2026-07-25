import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/AdminLayout";
import { Loader2, Zap, X, ChevronDown, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type UserItem = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
};

type OrderItem = {
  id: number;
  userId: string;
  type: string;
  lotSize: number;
  price: number;
  status: string;
  product: { id: number; symbol: string; name: string };
};

type TradeControlItem = {
  id: number;
  userId: string;
  tradeId: number;
  forceProfitable: boolean;
  profitSpeed: string;
  targetPips: number;
  isActive: boolean;
  createdAt: string;
  user?: { email: string; firstName?: string; lastName?: string };
  order?: { id: number; type: string; lotSize: number; price: number; product?: { symbol: string } };
};

type ControlState = {
  tradeId: number;
  currentPips: number;
  targetPips: number;
  progressPct: number;
  consolidating: boolean;
};

export default function TradeControl() {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedTradeId, setSelectedTradeId] = useState<number | null>(null);
  const [forceProfitable, setForceProfitable] = useState(true);
  const [profitSpeed, setProfitSpeed] = useState("normal");
  const [targetPips, setTargetPips] = useState(10);

  const { data: allUsers, isLoading: usersLoading } = useQuery<UserItem[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: userOrders, isLoading: ordersLoading } = useQuery<OrderItem[]>({
    queryKey: ["/api/admin/users", selectedUserId, "orders"],
    queryFn: async () => {
      if (!selectedUserId) return [];
      const res = await fetch(`/api/admin/users/${selectedUserId}/orders`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
    enabled: !!selectedUserId,
  });

  const { data: controls, isLoading: controlsLoading } = useQuery<TradeControlItem[]>({
    queryKey: ["/api/admin/trade-controls"],
  });

  const { data: controlStates } = useQuery<ControlState[]>({
    queryKey: ["/api/admin/trade-control-state"],
    queryFn: async () => {
      const res = await fetch("/api/admin/trade-control-state", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 3000,
  });

  const applyMutation = useMutation({
    mutationFn: async (data: { userId: string; tradeId: number; forceProfitable: boolean; profitSpeed: string; targetPips: number }) => {
      const res = await apiRequest("POST", "/api/admin/trade-control", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Trade control applied" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/trade-controls"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (tradeId: number) => {
      const res = await apiRequest("DELETE", `/api/admin/trade-control/${tradeId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Trade control deactivated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/trade-controls"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleApply = () => {
    if (!selectedUserId || !selectedTradeId) {
      toast({ title: "Select a user and trade first", variant: "destructive" });
      return;
    }
    applyMutation.mutate({
      userId: selectedUserId,
      tradeId: selectedTradeId,
      forceProfitable,
      profitSpeed,
      targetPips,
    });
  };

  const selectedOrder = userOrders?.find(o => o.id === selectedTradeId);

  const getControlState = (tradeId: number): ControlState | undefined => {
    return controlStates?.find(s => s.tradeId === tradeId);
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-display font-bold mb-6" data-testid="text-admin-trade-control">Trade Control</h1>

      <div className="bg-card rounded-2xl border border-white/5 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          Configure Trade Control
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Select User</label>
            <div className="relative">
              <select
                value={selectedUserId}
                onChange={(e) => {
                  setSelectedUserId(e.target.value);
                  setSelectedTradeId(null);
                }}
                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-sm appearance-none pr-8"
                data-testid="select-user"
              >
                <option value="">-- Select User --</option>
                {allUsers?.filter(u => !u.isAdmin).map(u => (
                  <option key={u.id} value={u.id}>
                    {u.email} {u.firstName ? `(${u.firstName} ${u.lastName || ""})` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Select Trade</label>
            <div className="relative">
              <select
                value={selectedTradeId ?? ""}
                onChange={(e) => setSelectedTradeId(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-sm appearance-none pr-8"
                disabled={!selectedUserId || ordersLoading}
                data-testid="select-trade"
              >
                <option value="">
                  {ordersLoading ? "Loading..." : !selectedUserId ? "Select user first" : userOrders?.length === 0 ? "No open trades" : "-- Select Trade --"}
                </option>
                {userOrders?.map(o => (
                  <option key={o.id} value={o.id}>
                    #{o.id} — {o.product.symbol} {o.type.toUpperCase()} {o.lotSize} lot @ {o.price.toFixed(4)}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {selectedOrder && (
          <div className="bg-background/50 rounded-lg p-3 mb-4 text-sm">
            <span className="text-muted-foreground">Selected: </span>
            <span className="font-medium">{selectedOrder.product.symbol}</span>
            <span className={`ml-2 ${selectedOrder.type === "buy" ? "text-emerald-400" : "text-red-400"}`}>
              {selectedOrder.type.toUpperCase()}
            </span>
            <span className="ml-2 text-muted-foreground">{selectedOrder.lotSize} lot @ {selectedOrder.price.toFixed(4)}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Force Profit</label>
            <button
              onClick={() => setForceProfitable(!forceProfitable)}
              className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                forceProfitable
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-background border border-white/10 text-muted-foreground"
              }`}
              data-testid="toggle-force-profit"
            >
              {forceProfitable ? "Enabled" : "Disabled"}
            </button>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Speed</label>
            <div className="relative">
              <select
                value={profitSpeed}
                onChange={(e) => setProfitSpeed(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-sm appearance-none pr-8"
                data-testid="select-speed"
              >
                <option value="slow">Slow (~1 pip avg/tick)</option>
                <option value="normal">Normal (~5 pips avg/tick)</option>
                <option value="fast">Fast (~20 pips avg/tick)</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Target Pips</label>
            <input
              type="number"
              min={1}
              max={100000}
              value={targetPips}
              onChange={(e) => setTargetPips(Number(e.target.value))}
              className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-sm"
              data-testid="input-target-pips"
            />
          </div>
        </div>

        <button
          onClick={handleApply}
          disabled={!selectedTradeId || applyMutation.isPending}
          className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2"
          data-testid="button-apply-control"
        >
          {applyMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Apply Trade Control
        </button>
      </div>

      <div className="bg-card rounded-2xl border border-white/5 p-6">
        <h2 className="text-lg font-semibold mb-4">Active Controls</h2>

        {controlsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          </div>
        ) : !controls || controls.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No trade controls configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-muted-foreground">
                  <th className="pb-3 pr-4">User</th>
                  <th className="pb-3 pr-4">Trade</th>
                  <th className="pb-3 pr-4">Lot Size</th>
                  <th className="pb-3 pr-4">Force Profit</th>
                  <th className="pb-3 pr-4">Speed</th>
                  <th className="pb-3 pr-4">Progress</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {controls.map(tc => {
                  const state = getControlState(tc.tradeId);
                  return (
                    <tr key={tc.id} className="border-b border-white/5" data-testid={`row-trade-control-${tc.id}`}>
                      <td className="py-3 pr-4">{tc.user?.email || tc.userId}</td>
                      <td className="py-3 pr-4">
                        {tc.order?.product?.symbol || `#${tc.tradeId}`}
                        {tc.order && (
                          <span className={`ml-1 text-xs ${tc.order.type === "buy" ? "text-emerald-400" : "text-red-400"}`}>
                            {tc.order.type.toUpperCase()}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">{tc.order?.lotSize ?? "—"}</td>
                      <td className="py-3 pr-4">
                        <span className={tc.forceProfitable ? "text-emerald-400" : "text-muted-foreground"}>
                          {tc.forceProfitable ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 capitalize">{tc.profitSpeed}</td>
                      <td className="py-3 pr-4 min-w-[160px]">
                        {state ? (
                          <div>
                            {state.consolidating ? (
                              <div className="flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400 text-xs font-medium">At target</span>
                                <span className="text-muted-foreground text-[10px]">({state.currentPips} / {state.targetPips})</span>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                                  <span>{state.currentPips} / {state.targetPips} pips</span>
                                  <span>{state.progressPct}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(state.progressPct, 100)}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">{tc.targetPips} pips</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          tc.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-muted-foreground"
                        }`}>
                          {tc.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3">
                        {tc.isActive && (
                          <button
                            onClick={() => deactivateMutation.mutate(tc.tradeId)}
                            disabled={deactivateMutation.isPending}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            data-testid={`button-deactivate-${tc.tradeId}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
