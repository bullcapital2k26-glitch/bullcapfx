import { ArrowRight, Shield, Zap, Globe, TrendingUp, BarChart3, DollarSign, LineChart, ChevronRight, Lock, Clock, Award } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

const TICKER_ITEMS = [
  { symbol: "EUR/USD", price: "1.0924", change: "+0.12%" },
  { symbol: "GBP/USD", price: "1.2741", change: "+0.08%" },
  { symbol: "XAU/USD", price: "2,341.50", change: "+0.43%" },
  { symbol: "BTC/USD", price: "68,420", change: "+1.24%" },
  { symbol: "NAS100", price: "19,842", change: "+0.31%" },
  { symbol: "USD/JPY", price: "154.82", change: "-0.06%" },
  { symbol: "US30", price: "39,120", change: "+0.19%" },
  { symbol: "ETH/USD", price: "3,142", change: "+2.11%" },
  { symbol: "WTI", price: "79.34", change: "-0.22%" },
  { symbol: "SPX500", price: "5,234", change: "+0.27%" },
];

function LiveTicker() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="overflow-hidden border-b border-t border-white/5 bg-card/40 backdrop-blur-sm py-2.5">
      <div className="ticker-track flex gap-10 whitespace-nowrap" ref={ref}>
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-sm font-mono flex-shrink-0">
            <span className="text-foreground/60 font-sans text-xs">{item.symbol}</span>
            <span className="font-bold text-foreground">{item.price}</span>
            <span className={item.change.startsWith("+") ? "text-emerald-400 text-xs" : "text-red-400 text-xs"}>
              {item.change}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Landing() {
  const { data: products } = useQuery<any[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const countByType = (type: string) =>
    products ? products.filter((p: any) => p.type === type).length : null;

  const forexCount = countByType("forex");
  const stockCount = countByType("stock");
  const indicesCount = countByType("indices");
  const commodityCount = countByType("commodity");
  const cryptoCount = countByType("crypto");
  const totalCount = products ? products.length : null;

  const instruments = [
    { icon: DollarSign, title: "Forex", desc: "28 major, minor & exotic pairs", count: forexCount, color: "from-blue-500/20 to-blue-600/5" },
    { icon: BarChart3, title: "Indices", desc: "US30, SPX500, NAS100 & more", count: indicesCount, color: "from-violet-500/20 to-violet-600/5" },
    { icon: Globe, title: "Commodities", desc: "Gold, Silver, Oil & Gas", count: commodityCount, color: "from-amber-500/20 to-amber-600/5" },
    { icon: LineChart, title: "Stocks", desc: "Top US tech & growth equities", count: stockCount, color: "from-emerald-500/20 to-emerald-600/5" },
    { icon: TrendingUp, title: "Crypto", desc: "BTC, ETH & digital assets", count: cryptoCount, color: "from-cyan-500/20 to-cyan-600/5" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track { animation: ticker 40s linear infinite; }
        .text-gradient-blue {
          background: linear-gradient(135deg, #4D9FFF 0%, #0066FF 50%, #00C8FF 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .glow-blue {
          box-shadow: 0 0 40px rgba(0, 102, 255, 0.25), 0 0 80px rgba(0, 102, 255, 0.1);
        }
      `}</style>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="Bull Capital FX" className="w-10 h-10 object-contain" />
            <span className="font-display font-bold text-lg tracking-tight">
              Bull Capital <span className="text-gradient-blue">FX</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Log In
            </a>
            <a href="/signup" className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-sm font-bold transition-all shadow-lg shadow-primary/25">
              Get Started
            </a>
          </div>
        </div>
      </header>

      {/* Live Ticker */}
      <div className="pt-16">
        <LiveTicker />
      </div>

      <main className="flex-1 flex flex-col">
        {/* Hero */}
        <section className="relative pt-24 pb-20 px-4 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[600px] h-[500px] bg-primary/10 blur-[140px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-cyan-500/8 blur-[100px] rounded-full pointer-events-none" />

          <div className="max-w-5xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-wider mb-6 border border-primary/20">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                LIVE MARKETS · 46+ INSTRUMENTS
              </span>

              <h1 className="text-5xl md:text-7xl font-display font-bold leading-[1.05] mb-6">
                Your Edge in<br />
                <span className="text-gradient-blue">Every Market</span>
              </h1>

              <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                Bull Capital FX gives you institutional-grade execution on Forex, Gold, Indices and Crypto —
                with spreads starting at 0.05 pips and leverage up to 1:100.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a href="/signup" className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground rounded-xl font-bold text-base hover:bg-primary/90 transition-all glow-blue flex items-center justify-center gap-2">
                  Open Live Account <ArrowRight className="w-4 h-4" />
                </a>
                <a href="#instruments" className="w-full sm:w-auto px-8 py-4 bg-secondary/60 text-foreground rounded-xl font-bold text-base hover:bg-secondary transition-all border border-white/8 flex items-center justify-center gap-2">
                  Explore Markets <ChevronRight className="w-4 h-4" />
                </a>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center justify-center gap-6 mt-10 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-primary" /> Segregated Funds</span>
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary" /> 24/5 Support</span>
                <span className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-primary" /> Licensed Broker</span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats strip */}
        <section className="px-4 mb-20">
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { value: totalCount ? `${totalCount}+` : "46+", label: "Tradeable Instruments" },
              { value: "0.05", label: "Min. Pip Spread" },
              { value: "<8ms", label: "Avg Execution" },
              { value: "1:100", label: "Max Leverage" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="bg-card/60 border border-white/5 p-5 rounded-2xl text-center"
              >
                <p className="text-2xl font-display font-bold text-primary">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Instruments */}
        <section id="instruments" className="py-20 px-4 bg-card/20 border-y border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-display font-bold mb-3">Everything Moves. We Cover It.</h2>
              <p className="text-muted-foreground max-w-lg mx-auto text-sm">One account, five markets, zero platform switching — trade what matters when it matters.</p>
            </div>

            <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
              {instruments.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className={`bg-gradient-to-br ${item.color} border border-white/5 hover:border-primary/30 p-6 rounded-2xl transition-all group text-center cursor-pointer`}
                >
                  <div className="w-11 h-11 bg-background/60 rounded-xl flex items-center justify-center text-primary mb-4 mx-auto group-hover:scale-110 transition-transform">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground mb-2 leading-snug">{item.desc}</p>
                  <p className="text-primary font-bold text-sm">{item.count !== null ? `${item.count} pairs` : "—"}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-display font-bold mb-3">Built for Serious Traders</h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">Every detail of Bull Capital FX is engineered around speed, accuracy and transparency.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: Zap,
                  title: "Sub-10ms Execution",
                  desc: "Orders hit the market in under 10 milliseconds. No requotes, no last-look delays — just instant fills at the price you see.",
                  highlight: "99.97% uptime SLA"
                },
                {
                  icon: Shield,
                  title: "Funds Always Protected",
                  desc: "Client money is held in fully segregated accounts with Tier-1 banking partners. Your capital is never mixed with company funds.",
                  highlight: "Segregated accounts"
                },
                {
                  icon: Globe,
                  title: "Raw Market Prices",
                  desc: "We feed live data from Massive.com, Twelve Data and Frankfurter ECB — aggregated, cleaned and delivered to your screen in real time.",
                  highlight: "3 live data sources"
                },
              ].map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-card border border-white/5 hover:border-primary/20 rounded-2xl p-7 group transition-all"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-5 group-hover:scale-110 transition-transform">
                    <f.icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold tracking-widest text-primary/70 uppercase">{f.highlight}</span>
                  <h3 className="text-lg font-bold mt-1 mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 px-4 bg-card/20 border-y border-white/5">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-display font-bold mb-10">Start Trading in 3 Steps</h2>
            <div className="grid md:grid-cols-3 gap-6 text-left">
              {[
                { step: "01", title: "Create Your Account", desc: "Sign up in under 2 minutes. No credit card required to get started." },
                { step: "02", title: "Fund Your Wallet", desc: "Deposit via bank transfer or crypto. Your funds appear instantly." },
                { step: "03", title: "Trade Live Markets", desc: "Open positions on Forex, Gold, Indices or Crypto with a single click." },
              ].map((s, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <span className="text-4xl font-display font-bold text-primary/20 leading-none">{s.step}</span>
                  <div>
                    <h3 className="font-bold text-sm mb-1">{s.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-display font-bold mb-4">Ready to Take Positions?</h2>
            <p className="text-muted-foreground mb-8 text-sm">Join Bull Capital FX and access global markets with the tools professionals use.</p>
            <a href="/signup" className="inline-flex items-center gap-2 px-10 py-4 bg-primary text-primary-foreground rounded-xl font-bold text-base hover:bg-primary/90 transition-all glow-blue">
              Open Free Account <ArrowRight className="w-4 h-4" />
            </a>
            <p className="text-xs text-muted-foreground/60 mt-4">Risk warning: CFDs involve significant risk. You may lose more than your initial deposit.</p>
          </div>
        </section>
      </main>

      <footer className="py-8 px-4 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Bull Capital FX" className="w-7 h-7 object-contain" />
            <span className="font-display font-bold text-sm">Bull Capital FX</span>
          </div>
          <p className="text-muted-foreground text-xs text-center max-w-sm">
            CFDs are complex instruments with a high risk of losing money rapidly due to leverage. Please ensure you understand how CFDs work before trading.
          </p>
          <p className="text-muted-foreground text-xs">© 2026 Bull Capital FX. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
