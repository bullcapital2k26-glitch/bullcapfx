export type InstrumentCategory = "forex" | "jpy_forex" | "metal" | "index" | "commodity" | "stock" | "crypto";

export type MarginMode = "standard" | "usd_base" | "jpy_quote";

export type Instrument = {
  symbol: string;
  category: InstrumentCategory;
  pipSize: number;
  pipValue: number;
  contractSize: number;
  decimals: number;
  spreadMin: number;
  spreadMax: number;
  microWalkMaxChange: number;
  microWalkDriftThreshold: number;
  meanRevertMaxChange: number;
  meanRevertDriftThreshold: number;
  marginMode: MarginMode;
};

const REGISTRY: Instrument[] = [
  { symbol: "EUR/USD", category: "forex", pipSize: 0.0001, pipValue: 10, contractSize: 100000, decimals: 5, spreadMin: 0.00010, spreadMax: 0.00020, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "standard" },
  { symbol: "GBP/USD", category: "forex", pipSize: 0.0001, pipValue: 10, contractSize: 100000, decimals: 5, spreadMin: 0.00015, spreadMax: 0.00030, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "standard" },
  { symbol: "USD/CHF", category: "forex", pipSize: 0.0001, pipValue: 10, contractSize: 100000, decimals: 5, spreadMin: 0.00010, spreadMax: 0.00025, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "usd_base" },
  { symbol: "USD/CAD", category: "forex", pipSize: 0.0001, pipValue: 10, contractSize: 100000, decimals: 5, spreadMin: 0.00012, spreadMax: 0.00025, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "usd_base" },
  { symbol: "AUD/USD", category: "forex", pipSize: 0.0001, pipValue: 10, contractSize: 100000, decimals: 5, spreadMin: 0.00010, spreadMax: 0.00020, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "standard" },
  { symbol: "NZD/USD", category: "forex", pipSize: 0.0001, pipValue: 10, contractSize: 100000, decimals: 5, spreadMin: 0.00015, spreadMax: 0.00030, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "standard" },
  { symbol: "EUR/GBP", category: "forex", pipSize: 0.0001, pipValue: 10, contractSize: 100000, decimals: 5, spreadMin: 0.00015, spreadMax: 0.00030, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "standard" },
  { symbol: "EUR/CHF", category: "forex", pipSize: 0.0001, pipValue: 10, contractSize: 100000, decimals: 5, spreadMin: 0.00015, spreadMax: 0.00030, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "standard" },
  { symbol: "GBP/CHF", category: "forex", pipSize: 0.0001, pipValue: 10, contractSize: 100000, decimals: 5, spreadMin: 0.00020, spreadMax: 0.00040, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "standard" },
  { symbol: "GBP/AUD", category: "forex", pipSize: 0.0001, pipValue: 10, contractSize: 100000, decimals: 5, spreadMin: 0.00025, spreadMax: 0.00050, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "standard" },
  { symbol: "GBP/NZD", category: "forex", pipSize: 0.0001, pipValue: 10, contractSize: 100000, decimals: 5, spreadMin: 0.00030, spreadMax: 0.00060, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "standard" },
  { symbol: "GBP/CAD", category: "forex", pipSize: 0.0001, pipValue: 10, contractSize: 100000, decimals: 5, spreadMin: 0.00025, spreadMax: 0.00050, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "standard" },
  { symbol: "EUR/AUD", category: "forex", pipSize: 0.0001, pipValue: 10, contractSize: 100000, decimals: 5, spreadMin: 0.00020, spreadMax: 0.00045, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "standard" },
  { symbol: "EUR/NZD", category: "forex", pipSize: 0.0001, pipValue: 10, contractSize: 100000, decimals: 5, spreadMin: 0.00025, spreadMax: 0.00055, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "standard" },
  { symbol: "EUR/CAD", category: "forex", pipSize: 0.0001, pipValue: 10, contractSize: 100000, decimals: 5, spreadMin: 0.00020, spreadMax: 0.00040, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "standard" },
  { symbol: "AUD/NZD", category: "forex", pipSize: 0.0001, pipValue: 10, contractSize: 100000, decimals: 5, spreadMin: 0.00020, spreadMax: 0.00040, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "standard" },
  { symbol: "AUD/CAD", category: "forex", pipSize: 0.0001, pipValue: 10, contractSize: 100000, decimals: 5, spreadMin: 0.00020, spreadMax: 0.00040, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "standard" },
  { symbol: "NZD/CAD", category: "forex", pipSize: 0.0001, pipValue: 10, contractSize: 100000, decimals: 5, spreadMin: 0.00025, spreadMax: 0.00050, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "standard" },

  { symbol: "USD/JPY", category: "jpy_forex", pipSize: 0.01, pipValue: 10, contractSize: 100000, decimals: 3, spreadMin: 0.010, spreadMax: 0.020, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "usd_base" },
  { symbol: "EUR/JPY", category: "jpy_forex", pipSize: 0.01, pipValue: 10, contractSize: 100000, decimals: 3, spreadMin: 0.015, spreadMax: 0.030, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "jpy_quote" },
  { symbol: "GBP/JPY", category: "jpy_forex", pipSize: 0.01, pipValue: 10, contractSize: 100000, decimals: 3, spreadMin: 0.020, spreadMax: 0.040, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "jpy_quote" },
  { symbol: "AUD/JPY", category: "jpy_forex", pipSize: 0.01, pipValue: 10, contractSize: 100000, decimals: 3, spreadMin: 0.015, spreadMax: 0.030, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "jpy_quote" },
  { symbol: "CAD/JPY", category: "jpy_forex", pipSize: 0.01, pipValue: 10, contractSize: 100000, decimals: 3, spreadMin: 0.015, spreadMax: 0.030, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "jpy_quote" },
  { symbol: "CHF/JPY", category: "jpy_forex", pipSize: 0.01, pipValue: 10, contractSize: 100000, decimals: 3, spreadMin: 0.015, spreadMax: 0.030, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "jpy_quote" },
  { symbol: "NZD/JPY", category: "jpy_forex", pipSize: 0.01, pipValue: 10, contractSize: 100000, decimals: 3, spreadMin: 0.015, spreadMax: 0.030, microWalkMaxChange: 0.000025, microWalkDriftThreshold: 0.0008, meanRevertMaxChange: 0.0003, meanRevertDriftThreshold: 0.02, marginMode: "jpy_quote" },

  { symbol: "XAU/USD", category: "metal", pipSize: 0.01, pipValue: 1, contractSize: 100, decimals: 2, spreadMin: 0.30, spreadMax: 0.60, microWalkMaxChange: 0.000010, microWalkDriftThreshold: 0.0003, meanRevertMaxChange: 0.00006, meanRevertDriftThreshold: 0.01, marginMode: "standard" },
  { symbol: "XAG/USD", category: "metal", pipSize: 0.01, pipValue: 1, contractSize: 5000, decimals: 2, spreadMin: 0.02, spreadMax: 0.04, microWalkMaxChange: 0.000010, microWalkDriftThreshold: 0.0003, meanRevertMaxChange: 0.00006, meanRevertDriftThreshold: 0.01, marginMode: "standard" },

  { symbol: "WTI", category: "commodity", pipSize: 1, pipValue: 1, contractSize: 1000, decimals: 2, spreadMin: 0.03, spreadMax: 0.08, microWalkMaxChange: 0.00015, microWalkDriftThreshold: 0.002, meanRevertMaxChange: 0.002, meanRevertDriftThreshold: 0.05, marginMode: "standard" },
  { symbol: "BRENT", category: "commodity", pipSize: 1, pipValue: 1, contractSize: 1000, decimals: 2, spreadMin: 0.03, spreadMax: 0.08, microWalkMaxChange: 0.00015, microWalkDriftThreshold: 0.002, meanRevertMaxChange: 0.002, meanRevertDriftThreshold: 0.05, marginMode: "standard" },
  { symbol: "NATGAS", category: "commodity", pipSize: 1, pipValue: 1, contractSize: 10000, decimals: 3, spreadMin: 0.005, spreadMax: 0.015, microWalkMaxChange: 0.00015, microWalkDriftThreshold: 0.002, meanRevertMaxChange: 0.002, meanRevertDriftThreshold: 0.05, marginMode: "standard" },

  { symbol: "AAPL", category: "stock", pipSize: 1, pipValue: 1, contractSize: 1, decimals: 2, spreadMin: 0.01, spreadMax: 0.05, microWalkMaxChange: 0.00008, microWalkDriftThreshold: 0.0015, meanRevertMaxChange: 0.002, meanRevertDriftThreshold: 0.03, marginMode: "standard" },
  { symbol: "TSLA", category: "stock", pipSize: 1, pipValue: 1, contractSize: 1, decimals: 2, spreadMin: 0.01, spreadMax: 0.05, microWalkMaxChange: 0.00008, microWalkDriftThreshold: 0.0015, meanRevertMaxChange: 0.002, meanRevertDriftThreshold: 0.03, marginMode: "standard" },
  { symbol: "NVDA", category: "stock", pipSize: 1, pipValue: 1, contractSize: 1, decimals: 2, spreadMin: 0.01, spreadMax: 0.05, microWalkMaxChange: 0.00008, microWalkDriftThreshold: 0.0015, meanRevertMaxChange: 0.002, meanRevertDriftThreshold: 0.03, marginMode: "standard" },
  { symbol: "AMZN", category: "stock", pipSize: 1, pipValue: 1, contractSize: 1, decimals: 2, spreadMin: 0.01, spreadMax: 0.05, microWalkMaxChange: 0.00008, microWalkDriftThreshold: 0.0015, meanRevertMaxChange: 0.002, meanRevertDriftThreshold: 0.03, marginMode: "standard" },
  { symbol: "GOOGL", category: "stock", pipSize: 1, pipValue: 1, contractSize: 1, decimals: 2, spreadMin: 0.01, spreadMax: 0.05, microWalkMaxChange: 0.00008, microWalkDriftThreshold: 0.0015, meanRevertMaxChange: 0.002, meanRevertDriftThreshold: 0.03, marginMode: "standard" },
  { symbol: "MSFT", category: "stock", pipSize: 1, pipValue: 1, contractSize: 1, decimals: 2, spreadMin: 0.01, spreadMax: 0.05, microWalkMaxChange: 0.00008, microWalkDriftThreshold: 0.0015, meanRevertMaxChange: 0.002, meanRevertDriftThreshold: 0.03, marginMode: "standard" },
  { symbol: "META", category: "stock", pipSize: 1, pipValue: 1, contractSize: 1, decimals: 2, spreadMin: 0.01, spreadMax: 0.05, microWalkMaxChange: 0.00008, microWalkDriftThreshold: 0.0015, meanRevertMaxChange: 0.002, meanRevertDriftThreshold: 0.03, marginMode: "standard" },
  { symbol: "NFLX", category: "stock", pipSize: 1, pipValue: 1, contractSize: 1, decimals: 2, spreadMin: 0.01, spreadMax: 0.05, microWalkMaxChange: 0.00008, microWalkDriftThreshold: 0.0015, meanRevertMaxChange: 0.002, meanRevertDriftThreshold: 0.03, marginMode: "standard" },
  { symbol: "AMD", category: "stock", pipSize: 1, pipValue: 1, contractSize: 1, decimals: 2, spreadMin: 0.01, spreadMax: 0.05, microWalkMaxChange: 0.00008, microWalkDriftThreshold: 0.0015, meanRevertMaxChange: 0.002, meanRevertDriftThreshold: 0.03, marginMode: "standard" },
  { symbol: "UBER", category: "stock", pipSize: 1, pipValue: 1, contractSize: 1, decimals: 2, spreadMin: 0.01, spreadMax: 0.05, microWalkMaxChange: 0.00008, microWalkDriftThreshold: 0.0015, meanRevertMaxChange: 0.002, meanRevertDriftThreshold: 0.03, marginMode: "standard" },

  { symbol: "US30", category: "index", pipSize: 1, pipValue: 1, contractSize: 1, decimals: 2, spreadMin: 0.50, spreadMax: 2.00, microWalkMaxChange: 0.00008, microWalkDriftThreshold: 0.0015, meanRevertMaxChange: 0.002, meanRevertDriftThreshold: 0.03, marginMode: "standard" },
  { symbol: "SPX500", category: "index", pipSize: 1, pipValue: 1, contractSize: 1, decimals: 2, spreadMin: 0.50, spreadMax: 2.00, microWalkMaxChange: 0.00008, microWalkDriftThreshold: 0.0015, meanRevertMaxChange: 0.002, meanRevertDriftThreshold: 0.03, marginMode: "standard" },
  { symbol: "NAS100", category: "index", pipSize: 1, pipValue: 1, contractSize: 1, decimals: 2, spreadMin: 0.50, spreadMax: 2.00, microWalkMaxChange: 0.00008, microWalkDriftThreshold: 0.0015, meanRevertMaxChange: 0.002, meanRevertDriftThreshold: 0.03, marginMode: "standard" },

  { symbol: "BTC/USD", category: "crypto", pipSize: 1, pipValue: 1, contractSize: 1, decimals: 2, spreadMin: 5.00, spreadMax: 50.00, microWalkMaxChange: 0.00015, microWalkDriftThreshold: 0.002, meanRevertMaxChange: 0.002, meanRevertDriftThreshold: 0.05, marginMode: "standard" },
  { symbol: "ETH/USD", category: "crypto", pipSize: 1, pipValue: 1, contractSize: 1, decimals: 2, spreadMin: 2.00, spreadMax: 20.00, microWalkMaxChange: 0.00015, microWalkDriftThreshold: 0.002, meanRevertMaxChange: 0.002, meanRevertDriftThreshold: 0.05, marginMode: "standard" },
  { symbol: "LTC/USD", category: "crypto", pipSize: 1, pipValue: 1, contractSize: 1, decimals: 2, spreadMin: 0.10, spreadMax: 1.00, microWalkMaxChange: 0.00015, microWalkDriftThreshold: 0.002, meanRevertMaxChange: 0.002, meanRevertDriftThreshold: 0.05, marginMode: "standard" },
];

const REGISTRY_MAP = new Map<string, Instrument>();
for (const inst of REGISTRY) {
  REGISTRY_MAP.set(inst.symbol, inst);
  REGISTRY_MAP.set(inst.symbol.replace("/", ""), inst);
}

const _warnedSymbols = new Set<string>();

export function getInstrument(symbol: string): Instrument {
  const key = symbol.toUpperCase();
  const found = REGISTRY_MAP.get(key) ?? REGISTRY_MAP.get(key.replace("/", ""));
  if (found) return found;
  if (!_warnedSymbols.has(key)) {
    _warnedSymbols.add(key);
    console.warn(`[InstrumentRegistry] Unknown symbol "${symbol}" — not in registry`);
  }
  return {
    symbol: key,
    category: "forex",
    pipSize: 0.0001,
    pipValue: 10,
    contractSize: 100000,
    decimals: 5,
    spreadMin: 0.00010,
    spreadMax: 0.00030,
    microWalkMaxChange: 0.000025,
    microWalkDriftThreshold: 0.0008,
    meanRevertMaxChange: 0.0003,
    meanRevertDriftThreshold: 0.02,
    marginMode: "standard",
  };
}

export function getAllInstruments(): Instrument[] {
  return REGISTRY;
}
