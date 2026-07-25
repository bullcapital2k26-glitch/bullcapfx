import { useLocation } from "wouter";
import { ArrowLeft, Bell, TrendingUp, ShoppingCart, Megaphone, Loader2 } from "lucide-react";
import { BottomNav } from "@/components/Navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Prefs = {
  notifPriceAlerts: boolean;
  notifOrderUpdates: boolean;
  notifMarginWarnings: boolean;
  notifPromotions: boolean;
};

export default function ProfileNotifications() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: prefs, isLoading } = useQuery<Prefs>({
    queryKey: ["/api/user/preferences"],
  });

  const mutation = useMutation({
    mutationFn: async (update: Partial<Prefs>) => {
      await apiRequest("PATCH", "/api/user/preferences", update);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
    },
    onError: () => {
      toast({ title: "Failed to save", description: "Could not update notification settings", variant: "destructive" });
    },
  });

  const toggle = (key: keyof Prefs) => {
    if (!prefs) return;
    mutation.mutate({ [key]: !prefs[key] });
  };

  const toggles = [
    { icon: TrendingUp, label: "Price Alerts", desc: "Get notified when instruments hit your target price", key: "notifPriceAlerts" as keyof Prefs },
    { icon: ShoppingCart, label: "Order Updates", desc: "SL/TP triggers, pending order executions, margin calls", key: "notifOrderUpdates" as keyof Prefs },
    { icon: Bell, label: "Margin Warnings", desc: "Alert when margin level drops below 150%", key: "notifMarginWarnings" as keyof Prefs },
    { icon: Megaphone, label: "Promotions", desc: "News, updates, and special offers", key: "notifPromotions" as keyof Prefs },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-6 pt-12 pb-6 bg-gradient-to-b from-secondary/30 to-background border-b border-white/5">
        <div className="flex items-center gap-4">
          <button onClick={() => setLocation("/profile")} className="p-2 rounded-lg hover:bg-white/5 transition-colors" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold font-display" data-testid="text-page-title">Notifications</h1>
            <p className="text-sm text-muted-foreground">Manage your notification preferences</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          toggles.map((item, i) => {
            const value = prefs?.[item.key] ?? false;
            return (
              <div key={i} className="flex items-center gap-4 p-4 bg-card rounded-xl border border-white/5" data-testid={`toggle-${item.label.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center text-foreground">
                  <item.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sm">{item.label}</h4>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <button
                  onClick={() => toggle(item.key)}
                  disabled={mutation.isPending}
                  className={`w-12 h-7 rounded-full transition-colors relative ${value ? "bg-primary" : "bg-secondary"}`}
                  data-testid={`switch-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
}
