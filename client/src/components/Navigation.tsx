import { Link, useLocation } from "wouter";
import { Home, BarChart2, PieChart, User, Wallet, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/markets", icon: BarChart2, label: "Markets" },
    { href: "/terminal", icon: Monitor, label: "Terminal" },
    { href: "/positions", icon: PieChart, label: "Order Book" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  if (location === "/auth" || location.startsWith("/admin") || location === "/terminal") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-white/5 z-50 pb-safe" data-testid="bottom-nav">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={cn(
              "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 relative",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )} data-testid={`nav-${item.label.toLowerCase()}`}>
              <item.icon className={cn("w-5 h-5 transition-transform", isActive && "scale-110")} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <span className="absolute bottom-1 w-1 h-1 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return { isMobile };
}
