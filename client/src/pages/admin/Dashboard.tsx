import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { Users, DollarSign, Clock, BarChart3, Loader2 } from "lucide-react";
import { formatUSD } from "@/lib/currency";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<{
    userCount: number;
    totalBalance: number;
    pendingTransactions: number;
    activePositions: number;
  }>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        </div>
      </AdminLayout>
    );
  }

  const cards = [
    { icon: Users, label: "Total Users", value: stats?.userCount || 0, color: "text-blue-400 bg-blue-400/10" },
    { icon: DollarSign, label: "Total Balance", value: formatUSD(stats?.totalBalance || 0), color: "text-emerald-400 bg-emerald-400/10" },
    { icon: Clock, label: "Pending Transactions", value: stats?.pendingTransactions || 0, color: "text-amber-400 bg-amber-400/10" },
    { icon: BarChart3, label: "Active Positions", value: stats?.activePositions || 0, color: "text-purple-400 bg-purple-400/10" },
  ];

  return (
    <AdminLayout>
      <h1 className="text-2xl font-display font-bold mb-6" data-testid="text-admin-dashboard">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <div key={i} className="bg-card p-6 rounded-2xl border border-white/5" data-testid={`stat-card-${i}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <span className="text-sm text-muted-foreground">{card.label}</span>
            </div>
            <p className="text-2xl font-bold font-display">{card.value}</p>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
