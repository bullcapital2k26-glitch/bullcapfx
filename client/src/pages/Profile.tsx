import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/Navigation";
import { LogOut, Settings, Bell, Shield, Wallet, ChevronRight, Crown, Users, Loader2, Headphones, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAccount } from "@/hooks/use-market";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function Profile() {
  const { user, logout } = useAuth();
  const { data: account } = useAccount();
  const { formatMoney } = useCurrency();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [ibCodeInput, setIbCodeInput] = useState("");
  const [showIbInput, setShowIbInput] = useState(false);

  const ibMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/user/ib-code", { ibCode: ibCodeInput });
    },
    onSuccess: () => {
      toast({ title: "IB Code set", description: "Your introducing broker code has been saved" });
      setShowIbInput(false);
      setIbCodeInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to set IB code", variant: "destructive" });
    },
  });

  const menuItems = [
    { icon: Wallet, label: "Wallet", desc: "Manage deposits & withdrawals", href: "/wallet" },
    { icon: ShieldCheck, label: "KYC Verification", desc: "Identity document verification", href: "/profile/kyc" },
    { icon: Headphones, label: "Online Service", desc: "Live chat support", href: "/profile/online-service" },
    { icon: Bell, label: "Notifications", desc: "Price alerts & order updates", href: "/profile/notifications" },
    { icon: Shield, label: "Security", desc: "Account security settings", href: "/profile/security" },
    { icon: Settings, label: "Preferences", desc: "Theme, currency, language", href: "/profile/preferences" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-6 pt-12 pb-8 bg-gradient-to-b from-secondary/30 to-background border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold font-display" data-testid="text-username">{user?.firstName} {user?.lastName}</h1>
            <p className="text-muted-foreground text-lg mt-1" data-testid="text-email">{user?.email}</p>
            <div className="mt-3 self-start px-5 py-1.5 rounded-full bg-primary/10 text-primary text-lg font-bold border border-primary/20">
              {account?.account ? formatMoney(account.account.balance) : "—"}
            </div>
          </div>
          <img src="/logo.svg" alt="Bull Capital FX" className="w-[125px] h-[125px] object-contain" data-testid="img-profile-avatar" />
        </div>
      </div>

      <div className="px-6 py-6 space-y-2">
        {user?.isAdmin && (
          <button
            onClick={() => setLocation("/admin")}
            className="w-full flex items-center gap-4 p-4 bg-primary/10 hover:bg-primary/20 rounded-xl border border-primary/20 transition-all group mb-4"
            data-testid="button-admin-panel"
          >
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <Crown className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="font-bold text-sm text-primary">Admin Panel</h4>
              <p className="text-xs text-primary/70">Manage users, transactions & support</p>
            </div>
            <ChevronRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
          </button>
        )}

        <div className="p-4 bg-card rounded-xl border border-white/5 space-y-3 mb-2" data-testid="section-ib-code">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center text-foreground">
              <Users className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm">IB Code</h4>
              {user?.ibCode ? (
                <p className="text-xs text-primary font-medium" data-testid="text-ib-code-value">{user.ibCode}</p>
              ) : (
                <p className="text-xs text-muted-foreground">No IB code set</p>
              )}
            </div>
            {!user?.ibCode && !showIbInput && (
              <button
                onClick={() => setShowIbInput(true)}
                className="text-xs font-bold text-primary px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                data-testid="button-add-ib-code"
              >
                Add Code
              </button>
            )}
          </div>
          {showIbInput && !user?.ibCode && (
            <div className="flex gap-2">
              <input
                type="text"
                value={ibCodeInput}
                onChange={e => setIbCodeInput(e.target.value)}
                placeholder="Enter IB code"
                className="flex-1 bg-secondary border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                data-testid="input-ib-code"
              />
              <button
                onClick={() => ibMutation.mutate()}
                disabled={!ibCodeInput.trim() || ibMutation.isPending}
                className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center gap-1"
                data-testid="button-save-ib-code"
              >
                {ibMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </button>
              <button
                onClick={() => { setShowIbInput(false); setIbCodeInput(""); }}
                className="px-3 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-sm transition-colors"
                data-testid="button-cancel-ib-code"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {menuItems.map((item, i) => (
          <button 
            key={i}
            onClick={() => item.href && setLocation(item.href)}
            className="w-full flex items-center gap-4 p-4 bg-card hover:bg-card/80 rounded-xl border border-white/5 transition-all group"
            data-testid={`menu-${item.label.toLowerCase()}`}
          >
            <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center text-foreground group-hover:text-primary transition-colors">
              <item.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="font-bold text-sm">{item.label}</h4>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
          </button>
        ))}

        <button 
          onClick={() => logout()}
          className="w-full flex items-center gap-4 p-4 mt-8 bg-destructive/10 hover:bg-destructive/20 rounded-xl border border-destructive/20 transition-all text-destructive"
          data-testid="button-logout"
        >
          <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
            <LogOut className="w-5 h-5" />
          </div>
          <div className="flex-1 text-left">
            <h4 className="font-bold text-sm">Log Out</h4>
            <p className="text-xs text-destructive/70">Sign out of your account</p>
          </div>
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
