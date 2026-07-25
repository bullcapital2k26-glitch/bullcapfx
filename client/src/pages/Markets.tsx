import { useState } from "react";
import { useProducts } from "@/hooks/use-market";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimePrices } from "@/hooks/use-websocket";
import { BottomNav } from "@/components/Navigation";
import { MarketCard } from "@/components/MarketCard";
import { Search } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const TABS = ["All", "Forex", "Commodity", "Stock", "Indices"];

export default function Markets() {
  const { user } = useAuth();
  const { data: products, isLoading } = useProducts();
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  useRealtimePrices();

  const filteredProducts = products?.filter(p => {
    const matchesTab = activeTab === "All" || p.type.toLowerCase() === activeTab.toLowerCase();
    const matchesSearch = p.symbol.toLowerCase().includes(search.toLowerCase()) || p.name.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 bg-background/80 backdrop-blur-md z-10 px-6 pt-12 pb-4 border-b border-white/5">
        <h1 className="text-2xl font-display font-bold mb-4" data-testid="text-markets-title">Markets</h1>
        
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search symbol or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-secondary/50 border-none rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
            data-testid="input-search"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                activeTab === tab 
                  ? "bg-primary text-white" 
                  : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
              )}
              data-testid={`tab-${tab.toLowerCase()}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6 space-y-3">
        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">Loading markets...</div>
        ) : filteredProducts?.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">No markets found</div>
        ) : (
          filteredProducts?.map(product => (
            <MarketCard
              key={product.id}
              product={product}
              onClick={() => setLocation(`/trade/${product.id}`)}
            />
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
