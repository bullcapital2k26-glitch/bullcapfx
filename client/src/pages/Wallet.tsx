import { useState } from "react";
import { useAccount, useTransactions, useCreateTransaction } from "@/hooks/use-market";
import { BottomNav } from "@/components/Navigation";
import { ArrowDownLeft, ArrowUpRight, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function Wallet() {
  const { data: portfolio } = useAccount();
  const { data: transactions, isLoading } = useTransactions();
  const { mutate: createTransaction, isPending } = useCreateTransaction();
  const { toast } = useToast();
  const { formatMoney } = useCurrency();

  const [showForm, setShowForm] = useState<"deposit" | "withdrawal" | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = () => {
    if (!showForm || !amount || parseFloat(amount) <= 0) return;
    createTransaction({
      type: showForm,
      amount: parseFloat(amount),
      note: note || undefined,
    }, {
      onSuccess: () => {
        toast({ title: "Request Submitted", description: `Your ${showForm} request has been submitted for approval.` });
        setShowForm(null);
        setAmount("");
        setNote("");
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  const statusIcon = (status: string) => {
    if (status === "approved") return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    if (status === "rejected") return <XCircle className="w-4 h-4 text-rose-400" />;
    return <Clock className="w-4 h-4 text-primary" />;
  };

  const statusColor = (status: string) => {
    if (status === "approved") return "text-emerald-400 bg-emerald-400/10";
    if (status === "rejected") return "text-rose-400 bg-rose-400/10";
    return "text-primary bg-primary/10";
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-6 pt-12 pb-6 border-b border-white/5">
        <h1 className="text-2xl font-display font-bold mb-1" data-testid="text-wallet-title">Wallet</h1>
        <p className="text-3xl font-bold" data-testid="text-wallet-balance">
          {formatMoney(parseFloat(portfolio?.account?.balance || "0"))}
        </p>
        <p className="text-sm text-muted-foreground">Available Balance</p>
      </div>

      <div className="px-6 py-6">
        <div className="grid grid-cols-2 gap-3 mb-8">
          <button
            onClick={() => setShowForm(showForm === "deposit" ? null : "deposit")}
            className={cn(
              "flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm transition-all",
              showForm === "deposit" ? "bg-emerald-500 text-white" : "bg-card border border-white/5 text-foreground hover:border-emerald-500/30"
            )}
            data-testid="button-deposit"
          >
            <ArrowDownLeft className="w-4 h-4" /> Deposit
          </button>
          <button
            onClick={() => setShowForm(showForm === "withdrawal" ? null : "withdrawal")}
            className={cn(
              "flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm transition-all",
              showForm === "withdrawal" ? "bg-rose-500 text-white" : "bg-card border border-white/5 text-foreground hover:border-rose-500/30"
            )}
            data-testid="button-withdrawal"
          >
            <ArrowUpRight className="w-4 h-4" /> Withdraw
          </button>
        </div>

        {showForm && (
          <div className="bg-card p-6 rounded-2xl border border-white/5 mb-8" data-testid="form-transaction">
            <h3 className="font-bold mb-4 capitalize">{showForm} Request</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Amount (USD)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-secondary/50 rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                  data-testid="input-amount"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Note (Optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note..."
                  className="w-full bg-secondary/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  data-testid="input-note"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={isPending || !amount || parseFloat(amount) <= 0}
                className={cn(
                  "w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50",
                  showForm === "deposit" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                )}
                data-testid="button-submit-transaction"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Submit ${showForm} Request`}
              </button>
            </div>
          </div>
        )}

        <h3 className="font-bold text-lg mb-4">Transaction History</h3>
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground">Loading...</div>
          ) : transactions?.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border border-dashed border-white/10 rounded-2xl bg-white/5" data-testid="empty-transactions">
              No transactions yet
            </div>
          ) : (
            transactions?.map(txn => (
              <div key={txn.id} className="bg-card p-4 rounded-xl border border-white/5 flex items-center gap-4" data-testid={`transaction-${txn.id}`}>
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", txn.type === "deposit" ? "bg-emerald-500/10" : "bg-rose-500/10")}>
                  {txn.type === "deposit" ? <ArrowDownLeft className="w-5 h-5 text-emerald-400" /> : <ArrowUpRight className="w-5 h-5 text-rose-400" />}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sm capitalize">{txn.type}</h4>
                  <p className="text-xs text-muted-foreground">{txn.createdAt ? new Date(txn.createdAt).toLocaleDateString() : ''}</p>
                </div>
                <div className="text-right">
                  <p className={cn("font-bold text-sm", txn.type === "deposit" ? "text-emerald-400" : "text-rose-400")}>
                    {txn.type === "deposit" ? "+" : "-"}{formatMoney(parseFloat(txn.amount))}
                  </p>
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", statusColor(txn.status))}>
                    {txn.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
