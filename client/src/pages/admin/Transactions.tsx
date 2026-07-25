import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { Loader2, CheckCircle, XCircle, Clock, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Transaction, User } from "@shared/schema";
import { formatUSD } from "@/lib/currency";

export default function AdminTransactions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: transactions, isLoading } = useQuery<(Transaction & { user?: User })[]>({
    queryKey: ["/api/admin/transactions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/transactions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/admin/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Transaction Updated" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const statusIcon = (status: string) => {
    if (status === "approved") return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    if (status === "rejected") return <XCircle className="w-4 h-4 text-rose-400" />;
    return <Clock className="w-4 h-4 text-amber-400" />;
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-display font-bold mb-6" data-testid="text-admin-transactions">Transactions</h1>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
      ) : transactions?.length === 0 ? (
        <p className="text-center py-10 text-muted-foreground">No transactions yet</p>
      ) : (
        <div className="space-y-3">
          {transactions?.map(txn => (
            <div key={txn.id} className="bg-card p-4 rounded-xl border border-white/5" data-testid={`admin-txn-${txn.id}`}>
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", txn.type === "deposit" ? "bg-emerald-500/10" : "bg-rose-500/10")}>
                  {txn.type === "deposit" ? <ArrowDownLeft className="w-5 h-5 text-emerald-400" /> : <ArrowUpRight className="w-5 h-5 text-rose-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm capitalize">{txn.type}</h4>
                  <p className="text-xs text-muted-foreground truncate">{txn.user?.email || txn.userId}</p>
                  {txn.note && <p className="text-[10px] text-muted-foreground">{txn.note}</p>}
                </div>
                <div className="text-right">
                  <p className={cn("font-bold text-sm", txn.type === "deposit" ? "text-emerald-400" : "text-rose-400")}>
                    {formatUSD(parseFloat(txn.amount))}
                  </p>
                  <div className="flex items-center gap-1 justify-end mt-1">
                    {statusIcon(txn.status)}
                    <span className="text-xs text-muted-foreground capitalize">{txn.status}</span>
                  </div>
                </div>
              </div>

              {txn.status === "pending" && (
                <div className="mt-3 pt-3 border-t border-white/5 flex gap-2">
                  <button
                    onClick={() => updateMutation.mutate({ id: txn.id, status: "approved" })}
                    disabled={updateMutation.isPending}
                    className="flex-1 py-2 bg-emerald-500 text-white rounded-lg font-bold text-sm hover:bg-emerald-400 transition-all disabled:opacity-50"
                    data-testid={`button-approve-${txn.id}`}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateMutation.mutate({ id: txn.id, status: "rejected" })}
                    disabled={updateMutation.isPending}
                    className="flex-1 py-2 bg-rose-500 text-white rounded-lg font-bold text-sm hover:bg-rose-400 transition-all disabled:opacity-50"
                    data-testid={`button-reject-${txn.id}`}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
