import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type CurrencyCode = "USD" | "EUR" | "GBP" | "JPY" | "INR";

interface CurrencyConfig {
  symbol: string;
  decimals: number;
  locale: string;
}

const CURRENCY_CONFIG: Record<CurrencyCode, CurrencyConfig> = {
  USD: { symbol: "$", decimals: 2, locale: "en-US" },
  EUR: { symbol: "€", decimals: 2, locale: "en-US" },
  GBP: { symbol: "£", decimals: 2, locale: "en-US" },
  JPY: { symbol: "¥", decimals: 0, locale: "en-US" },
  INR: { symbol: "₹", decimals: 2, locale: "en-US" },
};

interface CurrencyContextValue {
  currency: CurrencyCode;
  rate: number;
  formatMoney: (usdAmount: number) => string;
  isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "USD",
  rate: 1,
  formatMoney: (n) => "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  isLoading: false,
});

export function useCurrency() {
  return useContext(CurrencyContext);
}

interface Props { children: ReactNode }

export function CurrencyProvider({ children }: Props) {
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [rate, setRate] = useState(1);

  const { data: prefs } = useQuery<{ prefCurrency: string }>({
    queryKey: ["/api/user/preferences"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/user/preferences", { credentials: "include" });
        if (!res.ok) return null;
        return res.json();
      } catch { return null; }
    },
    staleTime: 30_000,
  });

  const prefCurrency = (prefs?.prefCurrency ?? "USD") as CurrencyCode;

  const { data: rates, isLoading } = useQuery<Record<string, number>>({
    queryKey: ["fx-rates", prefCurrency],
    queryFn: async () => {
      if (prefCurrency === "USD") return {};
      const res = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${prefCurrency}`);
      if (!res.ok) return {};
      const json = await res.json();
      return json.rates ?? {};
    },
    staleTime: 60 * 60 * 1000,
    enabled: prefCurrency !== "USD",
  });

  useEffect(() => {
    setCurrency(prefCurrency);
    if (prefCurrency === "USD") {
      setRate(1);
    } else if (rates && rates[prefCurrency] != null) {
      setRate(rates[prefCurrency]);
    }
  }, [prefCurrency, rates]);

  const formatMoney = (usdAmount: number): string => {
    const cfg = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.USD;
    const converted = usdAmount * rate;
    const abs = Math.abs(converted);
    const formatted = cfg.symbol + abs.toLocaleString(cfg.locale, {
      minimumFractionDigits: cfg.decimals,
      maximumFractionDigits: cfg.decimals,
    });
    return converted < 0 ? "-" + formatted : formatted;
  };

  return (
    <CurrencyContext.Provider value={{ currency, rate, formatMoney, isLoading }}>
      {children}
    </CurrencyContext.Provider>
  );
}
