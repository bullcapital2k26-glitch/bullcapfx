import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Product } from "@shared/schema";

interface MarketCardProps {
  product: Product;
  onClick?: () => void;
  compact?: boolean;
}

export function MarketCard({ product, onClick, compact = false }: MarketCardProps) {
  const isPositive = (product.change24h || 0) >= 0;
  
  return (
    <div 
      onClick={onClick}
      data-testid={`market-card-${product.id}`}
      className={cn(
        "cursor-pointer group relative overflow-hidden transition-all duration-300",
        "bg-card/40 hover:bg-card/60 border border-white/5 hover:border-white/10 rounded-xl",
        compact ? "p-3" : "p-4"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center text-lg font-display font-bold text-foreground ring-1 ring-white/10">
            {product.symbol.slice(0, 1)}
          </div>
          <div>
            <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">
              {product.symbol}
            </h4>
            {!compact && (
              <p className="text-xs text-muted-foreground">{product.name}</p>
            )}
          </div>
        </div>

        <div className="text-right">
          <p className="font-mono font-medium text-foreground">
            ${product.currentPrice.toLocaleString()}
          </p>
          <div className={cn(
            "flex items-center justify-end gap-1 text-xs font-medium mt-1",
            isPositive ? "text-emerald-400" : "text-rose-400"
          )}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(product.change24h || 0).toFixed(2)}%
          </div>
        </div>
      </div>
      
      {/* Hover Effect Gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );
}
