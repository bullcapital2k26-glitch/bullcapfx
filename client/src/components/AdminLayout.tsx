import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, ArrowLeftRight, FileText, MessageCircle, ArrowLeft, UserPlus, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const adminNav = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/transactions", icon: ArrowLeftRight, label: "Transactions" },
  { href: "/admin/orders", icon: FileText, label: "Orders" },
  { href: "/admin/chat", icon: MessageCircle, label: "Chat" },
  { href: "/admin/ib", icon: UserPlus, label: "IB Mgmt" },
  { href: "/admin/kyc", icon: ShieldCheck, label: "KYC" },
  { href: "/admin/trade-control", icon: Zap, label: "Trade Ctrl" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <a className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors" data-testid="link-admin-back">
                <ArrowLeft className="w-4 h-4" />
              </a>
            </Link>
            <img src="/logo.svg" alt="Bull Capital FX" className="w-9 h-9 object-contain" />
            <span className="font-display font-bold text-sm" data-testid="admin-brand">Admin Panel</span>
          </div>
        </div>
      </header>

      <div className="flex">
        <nav className="hidden md:flex flex-col w-56 min-h-[calc(100vh-56px)] bg-card/50 border-r border-white/5 p-3 gap-1">
          {adminNav.map(item => {
            const isActive = location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <a className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )} data-testid={`admin-nav-${item.label.toLowerCase()}`}>
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-white/5 z-50">
          <div className="flex overflow-x-auto scrollbar-hide items-center h-14 px-1">
            {adminNav.map(item => {
              const isActive = location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}>
                  <a className={cn(
                    "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium px-3 min-w-[56px] flex-shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} data-testid={`admin-nav-mobile-${item.label.toLowerCase()}`}>
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </a>
                </Link>
              );
            })}
          </div>
          <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-card/95 to-transparent" />
        </div>

        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
