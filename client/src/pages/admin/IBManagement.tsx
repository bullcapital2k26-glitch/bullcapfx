import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";
import { Users, DollarSign, BarChart3, Hash, Plus, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { formatUSD } from "@/lib/currency";

type IbStat = {
  ibCode: string;
  referredUsers: number;
  totalVolume: number;
  totalCommission: string;
};

type IbCodeEntry = {
  id: number;
  code: string;
  partnerName: string;
  commissionRate: string;
  isActive: boolean;
  createdAt: string;
};

export default function AdminIBManagement() {
  const { toast } = useToast();
  const [newCode, setNewCode] = useState("");
  const [newPartner, setNewPartner] = useState("");
  const [newRate, setNewRate] = useState("5.00");

  const { data: stats, isLoading: statsLoading } = useQuery<IbStat[]>({
    queryKey: ["/api/admin/ib-stats"],
  });

  const { data: ibCodesList, isLoading: codesLoading } = useQuery<IbCodeEntry[]>({
    queryKey: ["/api/admin/ib-codes"],
  });

  const createCode = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/ib-codes", { code: newCode, partnerName: newPartner, commissionRate: newRate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ib-codes"] });
      toast({ title: "IB Code Created", description: `Code "${newCode}" created for ${newPartner}` });
      setNewCode(""); setNewPartner(""); setNewRate("5.00");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create IB code", variant: "destructive" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/admin/ib-codes/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ib-codes"] });
    },
  });

  const deleteCode = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/ib-codes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ib-codes"] });
      toast({ title: "IB Code Deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to delete", variant: "destructive" });
    },
  });

  const totals = stats?.reduce((acc, s) => ({
    users: acc.users + s.referredUsers,
    volume: acc.volume + s.totalVolume,
    commission: acc.commission + Number(s.totalCommission),
  }), { users: 0, volume: 0, commission: 0 }) || { users: 0, volume: 0, commission: 0 };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-display font-bold mb-6" data-testid="text-ib-title">IB Management</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-card rounded-xl p-4 border border-border" data-testid="stat-total-ibs">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Hash className="w-4 h-4" /> Active IB Codes
          </div>
          <p className="text-2xl font-bold">{ibCodesList?.filter(c => c.isActive).length || 0}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border" data-testid="stat-referred-users">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Users className="w-4 h-4" /> Referred Users
          </div>
          <p className="text-2xl font-bold">{totals.users}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border" data-testid="stat-total-volume">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <BarChart3 className="w-4 h-4" /> Total Volume (lots)
          </div>
          <p className="text-2xl font-bold">{totals.volume.toFixed(2)}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border" data-testid="stat-total-commission">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <DollarSign className="w-4 h-4" /> Total Commission
          </div>
          <p className="text-2xl font-bold text-amber-400">{formatUSD(totals.commission)}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 mb-8">
        <h2 className="text-lg font-bold mb-4">Create IB Code</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())}
            placeholder="IB Code (e.g., JOHN2025)"
            className="bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
            data-testid="input-new-ib-code"
          />
          <input
            type="text" value={newPartner} onChange={e => setNewPartner(e.target.value)}
            placeholder="Partner Name"
            className="bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
            data-testid="input-partner-name"
          />
          <input
            type="text" value={newRate} onChange={e => setNewRate(e.target.value)}
            placeholder="$/lot (e.g., 5.00)"
            className="bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
            data-testid="input-commission-rate"
          />
          <button
            onClick={() => createCode.mutate()}
            disabled={!newCode.trim() || !newPartner.trim() || createCode.isPending}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-sm transition-colors disabled:opacity-50"
            data-testid="button-create-ib-code"
          >
            {createCode.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden mb-8">
        <h2 className="text-lg font-bold p-4 border-b border-border">IB Codes</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left p-4 font-medium">Code</th>
              <th className="text-left p-4 font-medium">Partner</th>
              <th className="text-right p-4 font-medium">Rate ($/lot)</th>
              <th className="text-center p-4 font-medium">Status</th>
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {codesLoading ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
            ) : !ibCodesList || ibCodesList.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No IB codes created yet</td></tr>
            ) : (
              ibCodesList.map((code) => (
                <tr key={code.id} className="border-b border-border hover:bg-secondary/20" data-testid={`ib-code-row-${code.id}`}>
                  <td className="p-4 font-mono font-bold text-amber-400">{code.code}</td>
                  <td className="p-4">{code.partnerName}</td>
                  <td className="p-4 text-right font-mono">{formatUSD(Number(code.commissionRate))}</td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => toggleActive.mutate({ id: code.id, isActive: !code.isActive })}
                      className={`text-xs font-bold px-2 py-1 rounded-full ${code.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-destructive/20 text-destructive'}`}
                      data-testid={`toggle-active-${code.id}`}
                    >
                      {code.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => deleteCode.mutate(code.id)}
                      className="p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                      data-testid={`delete-ib-${code.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <h2 className="text-lg font-bold p-4 border-b border-border">Referral Performance</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left p-4 font-medium">IB Code</th>
              <th className="text-right p-4 font-medium">Referred Users</th>
              <th className="text-right p-4 font-medium">Trade Volume (lots)</th>
              <th className="text-right p-4 font-medium">Commission Earned</th>
            </tr>
          </thead>
          <tbody>
            {statsLoading ? (
              <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
            ) : !stats || stats.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No IB referrals yet</td></tr>
            ) : (
              stats.map((stat, i) => (
                <tr key={i} className="border-b border-border hover:bg-secondary/20" data-testid={`ib-row-${i}`}>
                  <td className="p-4 font-mono font-bold text-amber-400">{stat.ibCode}</td>
                  <td className="p-4 text-right">{stat.referredUsers}</td>
                  <td className="p-4 text-right font-mono">{stat.totalVolume.toFixed(2)}</td>
                  <td className="p-4 text-right font-mono text-emerald-400">{formatUSD(Number(stat.totalCommission))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
