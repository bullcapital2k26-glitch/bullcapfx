import { useLocation } from "wouter";
import { ArrowLeft, Palette, DollarSign, Globe, BarChart3, Loader2 } from "lucide-react";
import { BottomNav } from "@/components/Navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/ThemeProvider";

type Prefs = {
  prefTheme: string;
  prefCurrency: string;
  prefLanguage: string;
  prefChartType: string;
};

export default function ProfilePreferences() {
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
      toast({ title: "Failed to save", description: "Could not update preferences", variant: "destructive" });
    },
  });

  const { setTheme: applyTheme } = useTheme();

  const updatePref = (key: keyof Prefs, value: string) => {
    if (key === "prefTheme") {
      applyTheme(value as "dark" | "light");
    }
    mutation.mutate({ [key]: value });
  };

  const theme = prefs?.prefTheme ?? "dark";
  const currency = prefs?.prefCurrency ?? "USD";
  const language = prefs?.prefLanguage ?? "en";
  const chartType = prefs?.prefChartType ?? "candlestick";

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-6 pt-12 pb-6 bg-gradient-to-b from-secondary/30 to-background border-b border-white/5">
        <div className="flex items-center gap-4">
          <button onClick={() => setLocation("/profile")} className="p-2 rounded-lg hover:bg-white/5 transition-colors" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold font-display" data-testid="text-page-title">Preferences</h1>
            <p className="text-sm text-muted-foreground">Customize your trading experience</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="px-6 py-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-primary" />
              <label className="text-sm font-bold">Theme</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[{ value: "dark", label: "Dark Mode" }, { value: "light", label: "Light Mode" }].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updatePref("prefTheme", opt.value)}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                    theme === opt.value
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                  data-testid={`button-theme-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-primary" />
              <label className="text-sm font-bold">Base Currency</label>
            </div>
            <select
              value={currency}
              onChange={e => updatePref("prefCurrency", e.target.value)}
              className="w-full bg-card border border-white/10 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-primary"
              data-testid="select-currency"
            >
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="JPY">JPY — Japanese Yen</option>
              <option value="INR">INR — Indian Rupee</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-primary" />
              <label className="text-sm font-bold">Language</label>
            </div>
            <select
              value={language}
              onChange={e => updatePref("prefLanguage", e.target.value)}
              className="w-full bg-card border border-white/10 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-primary"
              data-testid="select-language"
            >
              <option value="en">English</option>
              <option value="ar">Arabic</option>
              <option value="zh">Chinese</option>
              <option value="es">Spanish</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-primary" />
              <label className="text-sm font-bold">Default Chart Type</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[{ value: "candlestick", label: "Candlestick" }, { value: "line", label: "Line Chart" }].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updatePref("prefChartType", opt.value)}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                    chartType === opt.value
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                  data-testid={`button-chart-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
