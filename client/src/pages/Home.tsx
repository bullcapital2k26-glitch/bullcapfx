import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useProducts } from "@/hooks/use-market";
import { useRealtimePrices } from "@/hooks/use-websocket";
import { BottomNav } from "@/components/Navigation";
import { MarketCard } from "@/components/MarketCard";
import { Loader2, User, Bell, Shield, Settings, LogOut, X } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

export default function Home() {
  const { user, logout } = useAuth();
  const { data: products, isLoading: loadingProducts } = useProducts();
  const [, setLocation] = useLocation();
  const [showProfilePanel, setShowProfilePanel] = useState(false);

  useRealtimePrices();

  if (loadingProducts) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  const topMovers = products?.sort((a, b) => 
    Math.abs(b.change24h || 0) - Math.abs(a.change24h || 0)
  ).slice(0, 3) || [];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="px-6 pt-12 pb-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-muted-foreground text-sm font-medium">Welcome back,</p>
            <h1 className="text-2xl font-bold font-display" data-testid="text-greeting">{user?.firstName || 'Trader'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Bull Capital FX" className="w-14 h-14 object-contain" />
            <button
              onClick={() => setShowProfilePanel(true)}
              className="w-10 h-10 rounded-full bg-secondary overflow-hidden border border-border hover:border-primary/50 transition-colors cursor-pointer"
              data-testid="button-profile-avatar"
            >
              {user?.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold bg-primary/20 text-primary">
                  {user?.firstName?.[0] || 'U'}
                </div>
              )}
            </button>
          </div>
        </div>
      </header>

      <section className="px-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Top Movers</h3>
          <button 
            onClick={() => setLocation('/markets')}
            className="text-primary text-sm font-medium hover:underline"
            data-testid="link-see-all"
          >
            See All
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {topMovers.map((product) => (
            <div key={product.id} className="min-w-[160px]">
              <MarketCard 
                product={product} 
                compact 
                onClick={() => setLocation(`/trade/${product.id}`)} 
              />
            </div>
          ))}
          {topMovers.length === 0 && (
            <div className="text-muted-foreground text-sm italic">Loading markets...</div>
          )}
        </div>
      </section>

      <section className="px-6 mb-8">
        <h3 className="font-bold text-lg mb-4">Market Overview</h3>
        <div className="space-y-3">
          {products?.slice(0, 6).map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <MarketCard 
                product={product} 
                onClick={() => setLocation(`/trade/${product.id}`)} 
              />
            </motion.div>
          ))}
        </div>
      </section>

      {showProfilePanel && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setShowProfilePanel(false)}
            data-testid="profile-panel-backdrop"
          />
          <div className="fixed top-0 right-0 bottom-0 w-72 bg-card border-l border-border z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200" data-testid="profile-panel">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold font-display text-lg">Profile</h2>
                <button onClick={() => setShowProfilePanel(false)} className="p-1.5 rounded-lg hover:bg-secondary/50 transition-colors" data-testid="button-close-profile-panel">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-secondary overflow-hidden border border-border shrink-0">
                  {user?.profileImageUrl ? (
                    <img src={user.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold bg-primary/20 text-primary">
                      {user?.firstName?.[0] || 'U'}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 p-3 space-y-1">
              {[
                { icon: User, label: "My Profile", path: "/profile", testId: "link-profile" },
                { icon: Bell, label: "Notifications", path: "/profile/notifications", testId: "link-notifications" },
                { icon: Shield, label: "Security", path: "/profile/security", testId: "link-security" },
                { icon: Settings, label: "Preferences", path: "/profile/preferences", testId: "link-preferences" },
              ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => { setShowProfilePanel(false); setLocation(item.path); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary/50 transition-colors text-left group"
                  data-testid={item.testId}
                >
                  <item.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="p-4 border-t border-border">
              <button
                onClick={() => { setShowProfilePanel(false); logout(); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive font-bold text-sm transition-colors"
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
            </div>
          </div>
        </>
      )}

      <BottomNav />
    </div>
  );
}
