import { db } from "./db";
import { eq } from "drizzle-orm";
import { products, accounts, positions, getContractSize } from "@shared/schema";
import { getInstrument } from "@shared/instrumentRegistry";
import { log } from "./index";
import { storage } from "./storage";
import { priceModifier } from "./services/priceModifier";
import { calculatePnL, getMarginUSD } from "./utils/pipCalculator";

type PriceData = {
  currentPrice: number;
  change24h: number;
  basePrice: number;
  sessionBasePrice: number;
  symbol: string;
  type: string;
  bid: number;
  ask: number;
  spread: number;
  decimals: number;
  lastApiPrice: number | null;
  lastApiTime: number;
};

type TickRecord = { time: number; mid: number; bid: number; ask: number };

const MAX_TICK_HISTORY = 5000;
let tickHistory: Map<number, TickRecord[]> = new Map();

let priceCache: Map<number, PriceData> = new Map();
let wsClients: Set<any> = new Set();
let tickInterval: NodeJS.Timeout | null = null;
let persistInterval: NodeJS.Timeout | null = null;
let fetchInterval: NodeJS.Timeout | null = null;

// Polygon.io ticker symbols by market type
const SYMBOL_TO_POLYGON_FOREX: Record<string, string> = {
  "EUR/USD": "C:EURUSD",
  "GBP/USD": "C:GBPUSD",
  "USD/JPY": "C:USDJPY",
  "USD/CHF": "C:USDCHF",
  "USD/CAD": "C:USDCAD",
  "AUD/USD": "C:AUDUSD",
  "NZD/USD": "C:NZDUSD",
  "EUR/GBP": "C:EURGBP",
  "EUR/JPY": "C:EURJPY",
  "EUR/CHF": "C:EURCHF",
  "GBP/JPY": "C:GBPJPY",
  "GBP/CHF": "C:GBPCHF",
  "AUD/JPY": "C:AUDJPY",
  "CAD/JPY": "C:CADJPY",
  "CHF/JPY": "C:CHFJPY",
  "NZD/JPY": "C:NZDJPY",
  "GBP/AUD": "C:GBPAUD",
  "GBP/NZD": "C:GBPNZD",
  "GBP/CAD": "C:GBPCAD",
  "EUR/AUD": "C:EURAUD",
  "EUR/NZD": "C:EURNZD",
  "EUR/CAD": "C:EURCAD",
  "AUD/NZD": "C:AUDNZD",
  "AUD/CAD": "C:AUDCAD",
  "NZD/CAD": "C:NZDCAD",
  "XAU/USD": "C:XAUUSD",
  "XAG/USD": "C:XAGUSD",
};

const SYMBOL_TO_POLYGON_STOCK: Record<string, string> = {
  "AAPL": "AAPL",
  "TSLA": "TSLA",
  "NVDA": "NVDA",
  "AMZN": "AMZN",
  "GOOGL": "GOOGL",
  "MSFT": "MSFT",
  "META": "META",
  "NFLX": "NFLX",
  "AMD": "AMD",
  "UBER": "UBER",
};

const SYMBOL_TO_POLYGON_CRYPTO: Record<string, string> = {
  "BTC": "X:BTCUSD",
  "ETH": "X:ETHUSD",
  "SOL": "X:SOLUSD",
};

// Combined lookup helpers
function getPolygonTicker(platformSymbol: string): { ticker: string; market: "forex" | "stocks" | "crypto" } | undefined {
  if (SYMBOL_TO_POLYGON_FOREX[platformSymbol])
    return { ticker: SYMBOL_TO_POLYGON_FOREX[platformSymbol], market: "forex" };
  if (SYMBOL_TO_POLYGON_STOCK[platformSymbol])
    return { ticker: SYMBOL_TO_POLYGON_STOCK[platformSymbol], market: "stocks" };
  if (SYMBOL_TO_POLYGON_CRYPTO[platformSymbol])
    return { ticker: SYMBOL_TO_POLYGON_CRYPTO[platformSymbol], market: "crypto" };
  return undefined;
}

function getDecimalsForSymbol(symbol: string, _type: string): number {
  return getInstrument(symbol).decimals;
}

function getSpreadRange(symbol: string, _type: string): { min: number; max: number } {
  const inst = getInstrument(symbol);
  return { min: inst.spreadMin, max: inst.spreadMax };
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function getPolygonTickerForSymbol(platformSymbol: string): string | undefined {
  return getPolygonTicker(platformSymbol)?.ticker;
}

export function getBidAsk(productId: number): { bid: number; ask: number; spread: number; mid: number; decimals: number } | undefined {
  const cached = priceCache.get(productId);
  if (!cached) return undefined;
  return {
    bid: cached.bid,
    ask: cached.ask,
    spread: cached.spread,
    mid: cached.currentPrice,
    decimals: cached.decimals,
  };
}

export function getDecimals(productId: number): number {
  const cached = priceCache.get(productId);
  return cached?.decimals ?? 5;
}

export function getCurrentPrice(productId: number): number | undefined {
  return priceCache.get(productId)?.currentPrice;
}

export function getPriceHistory(productId: number): TickRecord[] {
  return tickHistory.get(productId) || [];
}

export function getAllPrices(): { id: number; currentPrice: number; change24h: number; bid: number; ask: number; spread: number; decimals: number }[] {
  return Array.from(priceCache.entries()).map(([id, data]) => ({
    id,
    currentPrice: data.currentPrice,
    change24h: data.change24h,
    bid: data.bid,
    ask: data.ask,
    spread: data.spread,
    decimals: data.decimals,
  }));
}

export function registerWsClient(ws: any) {
  wsClients.add(ws);
  ws.on("close", () => wsClients.delete(ws));

  const snapshot = Array.from(priceCache.entries()).map(([id, data]) => ({
    id,
    currentPrice: data.currentPrice,
    change24h: data.change24h,
    bid: data.bid,
    ask: data.ask,
    spread: data.spread,
    decimals: data.decimals,
  }));
  if (snapshot.length > 0) {
    try {
      ws.send(JSON.stringify({ type: "price_update", data: snapshot }));
    } catch {}
  }
}

export function broadcastPrices(updates: { id: number; currentPrice: number; change24h: number; bid: number; ask: number; spread: number; decimals: number }[]) {
  const msg = JSON.stringify({ type: "price_update", data: updates });
  for (const ws of wsClients) {
    try {
      if (ws.readyState === 1) ws.send(msg);
    } catch {
      wsClients.delete(ws);
    }
  }
}

export function broadcastChatMessage(targetUserIds: string[], message: any) {
  const msg = JSON.stringify({ type: "chat_message", data: message });
  for (const ws of wsClients) {
    try {
      if (ws.readyState === 1 && ws.userId && targetUserIds.includes(ws.userId)) {
        ws.send(msg);
      }
    } catch {
      wsClients.delete(ws);
    }
  }
}

export function broadcastToAdmins(message: any) {
  const msg = JSON.stringify({ type: "chat_message", data: message });
  for (const ws of wsClients) {
    try {
      if (ws.readyState === 1 && ws.isAdmin) {
        ws.send(msg);
      }
    } catch {
      wsClients.delete(ws);
    }
  }
}

function broadcastToUser(userId: string, payload: any) {
  const msg = JSON.stringify(payload);
  for (const ws of wsClients) {
    try {
      if (ws.readyState === 1 && ws.userId === userId) {
        ws.send(msg);
      }
    } catch {
      wsClients.delete(ws);
    }
  }
}

function broadcastPnlUpdates(pnlUpdates: Map<string, any[]>) {
  for (const [userId, updates] of pnlUpdates.entries()) {
    broadcastToUser(userId, { type: "pnl_update", data: updates });
  }
}

function getMicroWalk(price: number, anchorPrice: number, _type: string, symbol: string): number {
  const inst = getInstrument(symbol);
  const maxChange = inst.microWalkMaxChange;
  const driftThreshold = inst.microWalkDriftThreshold;

  let changePercent = (Math.random() * 2 - 1) * maxChange;

  if (anchorPrice > 0) {
    const driftRatio = (price - anchorPrice) / anchorPrice;
    if (Math.abs(driftRatio) > driftThreshold) {
      const overshoot = Math.abs(driftRatio) - driftThreshold;
      const reversionStrength = Math.min(overshoot * 10, 0.8);
      changePercent -= driftRatio * reversionStrength;
    }
  }

  return Math.max(price * (1 + changePercent), 0.0001);
}

function getMeanRevertingWalk(price: number, basePrice: number, _type: string, symbol: string): number {
  const inst = getInstrument(symbol);
  let maxChange = inst.meanRevertMaxChange;
  const driftThreshold = inst.meanRevertDriftThreshold;

  const spike = Math.random() < 0.05;
  if (spike) maxChange *= 2;

  let changePercent = (Math.random() * 2 - 1) * maxChange;

  if (basePrice > 0) {
    const driftRatio = (price - basePrice) / basePrice;
    if (Math.abs(driftRatio) > driftThreshold) {
      const overshoot = Math.abs(driftRatio) - driftThreshold;
      const reversionStrength = Math.min(overshoot * 5, 0.9);
      changePercent -= driftRatio * reversionStrength;
    }
  }

  return Math.max(price * (1 + changePercent), 0.0001);
}

// Frankfurter API (ECB) — free, unlimited, no API key, hourly forex rates
let frankfurterInterval: NodeJS.Timeout | null = null;
let coingeckoInterval: NodeJS.Timeout | null = null;

async function fetchFrankfurterForex() {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CHF,CAD,AUD,NZD");
    if (!res.ok) { log(`Frankfurter HTTP error: ${res.status}`); return; }
    const json = await res.json() as { rates: Record<string, number> };
    const rates = json.rates;
    if (!rates) { log("Frankfurter: no rates in response"); return; }

    const usdToEur = rates.EUR;
    const usdToGbp = rates.GBP;
    const usdToJpy = rates.JPY;
    const usdToChf = rates.CHF;
    const usdToCad = rates.CAD;
    const usdToAud = rates.AUD;
    const usdToNzd = rates.NZD;

    const derived: Record<string, number> = {};
    if (usdToEur) derived["EUR/USD"] = roundTo(1 / usdToEur, 5);
    if (usdToGbp) derived["GBP/USD"] = roundTo(1 / usdToGbp, 5);
    if (usdToJpy) derived["USD/JPY"] = roundTo(usdToJpy, 3);
    if (usdToChf) derived["USD/CHF"] = roundTo(usdToChf, 5);
    if (usdToCad) derived["USD/CAD"] = roundTo(usdToCad, 5);
    if (usdToAud) derived["AUD/USD"] = roundTo(1 / usdToAud, 5);
    if (usdToNzd) derived["NZD/USD"] = roundTo(1 / usdToNzd, 5);

    if (usdToEur && usdToGbp) derived["EUR/GBP"] = roundTo((1 / usdToEur) / (1 / usdToGbp), 5);
    if (usdToEur && usdToJpy) derived["EUR/JPY"] = roundTo((1 / usdToEur) * usdToJpy, 3);
    if (usdToEur && usdToChf) derived["EUR/CHF"] = roundTo((1 / usdToEur) * usdToChf, 5);
    if (usdToGbp && usdToJpy) derived["GBP/JPY"] = roundTo((1 / usdToGbp) * usdToJpy, 3);
    if (usdToGbp && usdToChf) derived["GBP/CHF"] = roundTo((1 / usdToGbp) * usdToChf, 5);
    if (usdToAud && usdToJpy) derived["AUD/JPY"] = roundTo((1 / usdToAud) * usdToJpy, 3);
    if (usdToCad && usdToJpy) derived["CAD/JPY"] = roundTo(usdToJpy / usdToCad, 3);
    if (usdToChf && usdToJpy) derived["CHF/JPY"] = roundTo(usdToJpy / usdToChf, 3);
    if (usdToNzd && usdToJpy) derived["NZD/JPY"] = roundTo((1 / usdToNzd) * usdToJpy, 3);
    if (usdToGbp && usdToAud) derived["GBP/AUD"] = roundTo((1 / usdToGbp) / (1 / usdToAud), 5);
    if (usdToGbp && usdToNzd) derived["GBP/NZD"] = roundTo((1 / usdToGbp) / (1 / usdToNzd), 5);
    if (usdToGbp && usdToCad) derived["GBP/CAD"] = roundTo((1 / usdToGbp) * usdToCad, 5);
    if (usdToEur && usdToAud) derived["EUR/AUD"] = roundTo((1 / usdToEur) / (1 / usdToAud), 5);
    if (usdToEur && usdToNzd) derived["EUR/NZD"] = roundTo((1 / usdToEur) / (1 / usdToNzd), 5);
    if (usdToEur && usdToCad) derived["EUR/CAD"] = roundTo((1 / usdToEur) * usdToCad, 5);
    if (usdToAud && usdToNzd) derived["AUD/NZD"] = roundTo((1 / usdToAud) / (1 / usdToNzd), 5);
    if (usdToAud && usdToCad) derived["AUD/CAD"] = roundTo((1 / usdToAud) * usdToCad, 5);
    if (usdToNzd && usdToCad) derived["NZD/CAD"] = roundTo((1 / usdToNzd) * usdToCad, 5);

    let count = 0;
    for (const [id, data] of priceCache.entries()) {
      const price = derived[data.symbol];
      if (price && price > 0) {
        applyPriceUpdate(id, price);
        count++;
      }
    }
    if (count > 0) log(`Frankfurter: updated ${count} forex prices`);
  } catch (err: any) {
    log(`Frankfurter fetch error: ${err.message || err}`);
  }
}

const COINGECKO_MAP: Record<string, string> = {
  "bitcoin": "BTC/USD",
  "ethereum": "ETH/USD",
  "litecoin": "LTC/USD",
};

async function fetchCoinGecko() {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,litecoin&vs_currencies=usd");
    if (!res.ok) { log(`CoinGecko HTTP error: ${res.status}`); return; }
    const json = await res.json() as Record<string, { usd: number }>;

    let count = 0;
    for (const [coinId, platformSymbol] of Object.entries(COINGECKO_MAP)) {
      const price = json[coinId]?.usd;
      if (!price || price <= 0) continue;
      for (const [id, data] of priceCache.entries()) {
        if (data.symbol === platformSymbol) {
          applyPriceUpdate(id, price);
          count++;
          break;
        }
      }
    }
    if (count > 0) log(`CoinGecko: updated ${count} crypto prices`);
  } catch (err: any) {
    log(`CoinGecko fetch error: ${err.message || err}`);
  }
}

// Twelve Data symbol mapping (commodities, metals, indices, stocks)
const SYMBOL_TO_TWELVEDATA: Record<string, string> = {
  "XAU/USD": "XAU/USD", "XAG/USD": "XAG/USD",
  "WTI": "CL1!", "BRENT": "BRENT/USD", "NATGAS": "NG1!",
  "US30": "DJI", "SPX500": "SPX", "NAS100": "NDX",
  "AAPL": "AAPL", "TSLA": "TSLA", "NVDA": "NVDA",
  "AMZN": "AMZN", "GOOGL": "GOOGL", "MSFT": "MSFT",
  "META": "META", "NFLX": "NFLX", "AMD": "AMD", "UBER": "UBER",
};

const TD_BATCH_SIZE = 8;
let tdBatches: { productId: number; platformSymbol: string; apiSymbol: string }[][] = [];
let tdBatchIndex = 0;

function buildTwelveDataBatches() {
  const all: { productId: number; platformSymbol: string; apiSymbol: string }[] = [];
  for (const [id, data] of priceCache.entries()) {
    const apiSymbol = SYMBOL_TO_TWELVEDATA[data.symbol];
    if (apiSymbol) all.push({ productId: id, platformSymbol: data.symbol, apiSymbol });
  }
  tdBatches = [];
  for (let i = 0; i < all.length; i += TD_BATCH_SIZE) {
    tdBatches.push(all.slice(i, i + TD_BATCH_SIZE));
  }
  tdBatchIndex = 0;
}

async function fetchTwelveData() {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey || tdBatches.length === 0) return;

  const batch = tdBatches[tdBatchIndex % tdBatches.length];
  tdBatchIndex++;

  const symbols = batch.map(b => b.apiSymbol).join(",");
  try {
    const res = await fetch(`https://api.twelvedata.com/price?symbol=${symbols}&apikey=${apiKey}`);
    if (!res.ok) { log(`Twelve Data HTTP error: ${res.status}`); return; }
    const json = await res.json() as Record<string, any>;
    if (json.code === 429) { log("Twelve Data rate limit hit"); return; }

    let count = 0;
    for (const item of batch) {
      const result = json[item.apiSymbol];
      if (!result || result.code || result.status === "error") continue;
      const newPrice = parseFloat(result.price);
      if (isNaN(newPrice) || newPrice <= 0) continue;
      applyPriceUpdate(item.productId, newPrice);
      count++;
    }
    if (count > 0) log(`Twelve Data: updated ${count} prices (batch ${tdBatchIndex}/${tdBatches.length})`);
  } catch (err: any) {
    log(`Twelve Data fetch error: ${err.message || err}`);
  }
}

// All symbols that can be fetched from Polygon, grouped by market
type PolygonSymbolEntry = { productId: number; platformSymbol: string; polygonTicker: string; market: "forex" | "stocks" | "crypto" };
let polygonSymbols: PolygonSymbolEntry[] = [];

function buildSymbolBatches() {
  polygonSymbols = [];
  for (const [id, data] of priceCache.entries()) {
    const info = getPolygonTicker(data.symbol);
    if (info) {
      polygonSymbols.push({ productId: id, platformSymbol: data.symbol, polygonTicker: info.ticker, market: info.market });
    }
  }
}

function applyPriceUpdate(productId: number, newPrice: number) {
  const data = priceCache.get(productId);
  if (!data) return;

  const referencePrice = data.lastApiPrice != null && data.lastApiPrice > 0 ? data.lastApiPrice : data.currentPrice;
  const gapRatio = referencePrice > 0 ? Math.abs(newPrice - referencePrice) / referencePrice : 0;
  let gapThreshold = 0.002;
  if (data.type === "commodity") gapThreshold = 0.008;
  else if (data.type === "stock" || data.type === "indices") gapThreshold = 0.005;
  else if (data.type === "crypto") gapThreshold = 0.008;

  if (gapRatio > gapThreshold) {
    const halfSpread = data.spread / 2 || 0;
    const now = Math.floor(Date.now() / 1000);
    tickHistory.set(productId, [{
      time: now,
      mid: newPrice,
      bid: parseFloat((newPrice - halfSpread).toFixed(data.decimals)),
      ask: parseFloat((newPrice + halfSpread).toFixed(data.decimals)),
    }]);
  }

  data.lastApiPrice = newPrice;
  data.lastApiTime = Date.now();
  data.currentPrice = newPrice;
  data.basePrice = newPrice;

  if (data.sessionBasePrice === 0) {
    data.sessionBasePrice = newPrice;
  }
  data.change24h = data.sessionBasePrice > 0
    ? parseFloat((((newPrice - data.sessionBasePrice) / data.sessionBasePrice) * 100).toFixed(4))
    : 0;
}

async function fetchPolygonGroup(
  apiKey: string,
  entries: PolygonSymbolEntry[],
  market: "forex" | "stocks" | "crypto"
): Promise<number> {
  if (entries.length === 0) return 0;

  const tickers = entries.map(e => e.polygonTicker).join(",");
  let url: string;

  if (market === "forex") {
    url = `https://api.massive.com/v2/snapshot/locale/global/markets/forex/tickers?tickers=${tickers}&apiKey=${apiKey}`;
  } else if (market === "stocks") {
    url = `https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers}&apiKey=${apiKey}`;
  } else {
    url = `https://api.massive.com/v2/snapshot/locale/global/markets/crypto/tickers?tickers=${tickers}&apiKey=${apiKey}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    log(`Polygon ${market} API HTTP error: ${response.status}`);
    return 0;
  }

  const json = await response.json() as Record<string, any>;

  if (json.status === "ERROR" || json.error) {
    log(`Polygon ${market} API error: ${json.error || json.message}`);
    return 0;
  }

  const tickerResults = json.tickers as any[] | undefined;
  if (!tickerResults) return 0;

  // Build a map from polygon ticker → price
  const priceMap = new Map<string, number>();
  for (const t of tickerResults) {
    let price: number | undefined;

    if (market === "forex") {
      // Use mid of lastQuote bid/ask, or day close
      if (t.lastQuote?.a && t.lastQuote?.b) {
        price = (parseFloat(t.lastQuote.a) + parseFloat(t.lastQuote.b)) / 2;
      } else if (t.day?.c) {
        price = parseFloat(t.day.c);
      }
    } else {
      // stocks and crypto
      if (t.lastTrade?.p) {
        price = parseFloat(t.lastTrade.p);
      } else if (t.day?.c) {
        price = parseFloat(t.day.c);
      }
    }

    if (price && !isNaN(price) && price > 0) {
      priceMap.set(t.ticker, price);
    }
  }

  let updatedCount = 0;
  for (const entry of entries) {
    const newPrice = priceMap.get(entry.polygonTicker);
    if (!newPrice) continue;
    applyPriceUpdate(entry.productId, newPrice);
    updatedCount++;
  }

  return updatedCount;
}

async function fetchMarketData() {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey || polygonSymbols.length === 0) return;

  const byMarket = {
    forex: polygonSymbols.filter(s => s.market === "forex"),
    stocks: polygonSymbols.filter(s => s.market === "stocks"),
    crypto: polygonSymbols.filter(s => s.market === "crypto"),
  };

  try {
    const [fxCount, stCount, crCount] = await Promise.all([
      fetchPolygonGroup(apiKey, byMarket.forex, "forex"),
      fetchPolygonGroup(apiKey, byMarket.stocks, "stocks"),
      fetchPolygonGroup(apiKey, byMarket.crypto, "crypto"),
    ]);

    const total = fxCount + stCount + crCount;
    if (total > 0) {
      log(`Polygon: updated ${total} prices (fx:${fxCount} stocks:${stCount} crypto:${crCount})`);
    }
  } catch (err: any) {
    log(`Polygon fetch error: ${err.message || err}`);
  }
}

async function initPriceCache() {
  const allProducts = await db.select().from(products);
  for (const p of allProducts) {
    const decimals = getDecimalsForSymbol(p.symbol, p.type);
    const spreadRange = getSpreadRange(p.symbol, p.type);
    const spread = randomInRange(spreadRange.min, spreadRange.max);
    const mid = p.currentPrice;
    const halfSpread = spread / 2;
    priceCache.set(p.id, {
      currentPrice: mid,
      change24h: p.change24h || 0,
      basePrice: mid,
      sessionBasePrice: mid,
      symbol: p.symbol,
      type: p.type,
      bid: roundTo(mid - halfSpread, decimals),
      ask: roundTo(mid + halfSpread, decimals),
      spread: roundTo(spread, decimals),
      decimals,
      lastApiPrice: null,
      lastApiTime: 0,
    });
  }
}

// Polygon symbol map for /prev endpoint (free tier)
const POLYGON_PREV_SYMBOLS: Record<string, string> = {
  "EUR/USD": "C:EURUSD", "GBP/USD": "C:GBPUSD", "USD/JPY": "C:USDJPY",
  "USD/CHF": "C:USDCHF", "USD/CAD": "C:USDCAD", "AUD/USD": "C:AUDUSD",
  "NZD/USD": "C:NZDUSD", "XAU/USD": "C:XAUUSD", "XAG/USD": "C:XAGUSD",
  "NZD/JPY": "C:NZDJPY", "GBP/AUD": "C:GBPAUD", "GBP/NZD": "C:GBPNZD",
  "GBP/CAD": "C:GBPCAD", "EUR/AUD": "C:EURAUD", "EUR/NZD": "C:EURNZD",
  "EUR/CAD": "C:EURCAD", "AUD/NZD": "C:AUDNZD", "AUD/CAD": "C:AUDCAD",
  "NZD/CAD": "C:NZDCAD",
  "AAPL": "AAPL", "TSLA": "TSLA", "NVDA": "NVDA",
  "AMZN": "AMZN", "GOOGL": "GOOGL", "MSFT": "MSFT",
  "META": "META", "NFLX": "NFLX", "AMD": "AMD", "UBER": "UBER",
  "BTC/USD": "X:BTCUSD", "ETH/USD": "X:ETHUSD", "LTC/USD": "X:LTCUSD",
  "WTI": "CL", // CL = crude oil futures
};

// Derive cross rates from majors already in cache
function deriveCrossRates() {
  const get = (sym: string) => {
    for (const [, data] of priceCache.entries()) {
      if (data.symbol === sym) return data.currentPrice;
    }
    return null;
  };

  const eurusd = get("EUR/USD"), gbpusd = get("GBP/USD"), usdjpy = get("USD/JPY");
  const usdchf = get("USD/CHF"), audusd = get("AUD/USD"), usdcad = get("USD/CAD");
  const nzdusd = get("NZD/USD");

  const crosses: Record<string, number | null> = {
    "EUR/GBP": eurusd && gbpusd ? eurusd / gbpusd : null,
    "EUR/JPY": eurusd && usdjpy ? eurusd * usdjpy : null,
    "EUR/CHF": eurusd && usdchf ? eurusd * usdchf : null,
    "GBP/JPY": gbpusd && usdjpy ? gbpusd * usdjpy : null,
    "GBP/CHF": gbpusd && usdchf ? gbpusd * usdchf : null,
    "AUD/JPY": audusd && usdjpy ? audusd * usdjpy : null,
    "CAD/JPY": usdcad && usdjpy ? usdjpy / usdcad : null,
    "CHF/JPY": usdchf && usdjpy ? usdjpy / usdchf : null,
    "NZD/JPY": nzdusd && usdjpy ? nzdusd * usdjpy : null,
    "GBP/AUD": gbpusd && audusd ? gbpusd / audusd : null,
    "GBP/NZD": gbpusd && nzdusd ? gbpusd / nzdusd : null,
    "GBP/CAD": gbpusd && usdcad ? gbpusd * usdcad : null,
    "EUR/AUD": eurusd && audusd ? eurusd / audusd : null,
    "EUR/NZD": eurusd && nzdusd ? eurusd / nzdusd : null,
    "EUR/CAD": eurusd && usdcad ? eurusd * usdcad : null,
    "AUD/NZD": audusd && nzdusd ? audusd / nzdusd : null,
    "AUD/CAD": audusd && usdcad ? audusd * usdcad : null,
    "NZD/CAD": nzdusd && usdcad ? nzdusd * usdcad : null,
  };

  for (const [id, data] of priceCache.entries()) {
    const derived = crosses[data.symbol];
    if (derived && derived > 0) {
      const decimals = data.decimals;
      const spread = data.spread;
      const halfSpread = spread / 2;
      data.currentPrice = roundTo(derived, decimals);
      data.basePrice = data.currentPrice;
      data.sessionBasePrice = data.currentPrice;
      data.bid = roundTo(data.currentPrice - halfSpread, decimals);
      data.ask = roundTo(data.currentPrice + halfSpread, decimals);
      data.lastApiPrice = data.currentPrice;
      data.lastApiTime = Date.now();
    }
  }
}

async function seedPricesFromPolygon() {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return;

  // Verified fallback prices (Frankfurter ECB + CoinGecko + Polygon, 2026-03-12)
  const PRICE_FALLBACKS: Record<string, number> = {
    "EUR/USD": 1.1581, "GBP/USD": 1.3408, "USD/JPY": 158.56,
    "USD/CHF": 0.7799, "USD/CAD": 1.3593, "AUD/USD": 0.7152,
    "NZD/USD": 0.5917, "XAG/USD": 33.65,
    "NZD/JPY": 93.82, "GBP/AUD": 1.8744, "GBP/NZD": 2.2658,
    "GBP/CAD": 1.8212, "EUR/AUD": 1.6196, "EUR/NZD": 1.9574,
    "EUR/CAD": 1.5729, "AUD/NZD": 1.0789, "AUD/CAD": 0.9625, "NZD/CAD": 0.7963,
    "WTI": 92.49, "BRENT": 95.20, "NATGAS": 3.85,
    "AAPL": 260.83, "TSLA": 399.235, "NVDA": 184.77,
    "AMZN": 205.50, "GOOGL": 172.80, "MSFT": 415.20,
    "META": 610.40, "NFLX": 985.60, "AMD": 112.35, "UBER": 82.75,
    "NAS100": 24956.47, "US30": 43205.0, "SPX500": 5667.0,
    "BTC/USD": 70468.0, "ETH/USD": 2066.57, "LTC/USD": 87.30,
  };

  const seedPrice = async (id: number, data: any, price: number) => {
    const decimals = data.decimals;
    const spread = data.spread;
    const halfSpread = spread / 2;
    data.currentPrice = roundTo(price, decimals);
    data.basePrice = data.currentPrice;
    data.sessionBasePrice = data.currentPrice;
    data.bid = roundTo(data.currentPrice - halfSpread, decimals);
    data.ask = roundTo(data.currentPrice + halfSpread, decimals);
    data.lastApiPrice = data.currentPrice;
    data.lastApiTime = Date.now();
    await db.update(products).set({ currentPrice: data.currentPrice, change24h: 0 }).where(eq(products.id, id));
  };

  let seeded = 0;
  for (const [id, data] of priceCache.entries()) {
    const ticker = POLYGON_PREV_SYMBOLS[data.symbol];

    // Try live Polygon fetch first
    if (ticker) {
      try {
        const res = await fetch(`https://api.massive.com/v2/aggs/ticker/${ticker}/prev?apiKey=${apiKey}`);
        const json = await res.json() as Record<string, any>;
        const price = json.results?.[0]?.c;
        if (price && !isNaN(price) && price > 0) {
          await seedPrice(id, data, price);
          seeded++;
          continue;
        }
      } catch { /* fall through to fallback */ }
    }

    // Apply fallback price if Polygon didn't return data
    const fallback = PRICE_FALLBACKS[data.symbol];
    if (fallback && fallback > 0) {
      await seedPrice(id, data, fallback);
      seeded++;
    }
  }

  if (seeded > 0) {
    deriveCrossRates();
    log(`Polygon seed: ${seeded} prices applied (live + fallback)`);
  }
}

let tickCounter = 0;

async function tick() {
  const updates: { id: number; currentPrice: number; change24h: number; bid: number; ask: number; spread: number; decimals: number }[] = [];

  for (const [id, data] of priceCache.entries()) {
    let newMid: number;

    const STALE_THRESHOLD_MS = 5 * 60 * 1000;
    const isApiStale = data.lastApiPrice !== null && (Date.now() - data.lastApiTime) > STALE_THRESHOLD_MS;

    if (data.lastApiPrice !== null && !isApiStale) {
      newMid = getMicroWalk(data.currentPrice, data.lastApiPrice, data.type, data.symbol);
    } else {
      newMid = getMeanRevertingWalk(data.currentPrice, data.basePrice, data.type, data.symbol);
    }

    const refPrice = data.sessionBasePrice > 0 ? data.sessionBasePrice : data.basePrice;
    const change24h = refPrice > 0 ? ((newMid - refPrice) / refPrice) * 100 : 0;

    const clampedMid = Math.max(newMid, 0.0001);
    const spreadRange = getSpreadRange(data.symbol, data.type);
    const spread = randomInRange(spreadRange.min, spreadRange.max);
    const halfSpread = spread / 2;

    data.currentPrice = clampedMid;
    data.change24h = parseFloat(change24h.toFixed(4));
    data.bid = roundTo(clampedMid - halfSpread, data.decimals);
    data.ask = roundTo(clampedMid + halfSpread, data.decimals);
    data.spread = roundTo(spread, data.decimals);

    let hist = tickHistory.get(id);
    if (!hist) { hist = []; tickHistory.set(id, hist); }
    hist.push({ time: Math.floor(Date.now() / 1000), mid: data.currentPrice, bid: data.bid, ask: data.ask });
    if (hist.length > MAX_TICK_HISTORY) hist.shift();

    updates.push({
      id,
      currentPrice: data.currentPrice,
      change24h: data.change24h,
      bid: data.bid,
      ask: data.ask,
      spread: data.spread,
      decimals: data.decimals,
    });
  }

  broadcastPrices(updates);

  priceModifier.advanceAll();

  tickCounter++;
  try {
    await checkSlTpAndBroadcastPnl();
  } catch {}
  if (tickCounter % 3 === 0) {
    try {
      await checkPendingOrders();
    } catch {}
    try {
      await checkMarginLiquidation();
    } catch {}
  }
}

async function checkSlTpAndBroadcastPnl() {
  let openOrders;
  try {
    openOrders = await storage.getAllOpenOrders();
  } catch {
    return;
  }
  if (!openOrders || openOrders.length === 0) return;

  const pnlUpdates = new Map<string, any[]>();

  for (const order of openOrders) {
    const cached = priceCache.get(order.productId);
    if (!cached) continue;

    let checkPrice: number;
    let closePrice: number;

    const rawPrice = order.type === "buy" ? cached.bid : cached.ask;
    const effectivePrice = priceModifier.getEffectivePrice(order.id, order.price, rawPrice, order.type);

    checkPrice = effectivePrice;
    closePrice = effectivePrice;
    const unrealizedPnl = calculatePnL(order.product.symbol, order.type, order.price, effectivePrice, order.lotSize);

    let shouldClose = false;
    let closeReason = "";

    if (order.type === "buy") {
      if (order.stopLoss && checkPrice <= order.stopLoss) {
        shouldClose = true;
        closeReason = "stop_loss";
      } else if (order.takeProfit && checkPrice >= order.takeProfit) {
        shouldClose = true;
        closeReason = "take_profit";
      }
    } else {
      if (order.stopLoss && checkPrice >= order.stopLoss) {
        shouldClose = true;
        closeReason = "stop_loss";
      } else if (order.takeProfit && checkPrice <= order.takeProfit) {
        shouldClose = true;
        closeReason = "take_profit";
      }
    }

    if (shouldClose) {
      try {
        priceModifier.remove(order.id);
        const closed = await storage.closeOrder(order.id, closePrice, closeReason);
        broadcastToUser(order.userId, {
          type: "position_closed",
          data: {
            orderId: order.id,
            symbol: order.product.symbol,
            reason: closeReason,
            pnl: closed.pnl,
            closePrice,
          }
        });
      } catch {}
    } else {
      if (!pnlUpdates.has(order.userId)) {
        pnlUpdates.set(order.userId, []);
      }
      pnlUpdates.get(order.userId)!.push({
        orderId: order.id,
        productId: order.productId,
        symbol: order.product.symbol,
        unrealizedPnl: parseFloat(unrealizedPnl.toFixed(2)),
        currentPrice: effectivePrice,
        entryPrice: order.price,
        lotSize: order.lotSize,
        type: order.type,
      });
    }
  }

  broadcastPnlUpdates(pnlUpdates);
}

async function checkPendingOrders() {
  let pendingOrders;
  try {
    pendingOrders = await storage.getAllPendingOrders();
  } catch {
    return;
  }
  if (!pendingOrders || pendingOrders.length === 0) return;

  for (const order of pendingOrders) {
    const cached = priceCache.get(order.productId);
    if (!cached || !order.triggerPrice) continue;

    let shouldExecute = false;
    let executionPrice: number;

    switch (order.orderType) {
      case "buy_limit":
        shouldExecute = cached.ask <= order.triggerPrice;
        executionPrice = cached.ask;
        break;
      case "sell_limit":
        shouldExecute = cached.bid >= order.triggerPrice;
        executionPrice = cached.bid;
        break;
      case "buy_stop":
        shouldExecute = cached.ask >= order.triggerPrice;
        executionPrice = cached.ask;
        break;
      case "sell_stop":
        shouldExecute = cached.bid <= order.triggerPrice;
        executionPrice = cached.bid;
        break;
      default:
        continue;
    }

    if (shouldExecute) {
      try {
        const executed = await storage.executePendingOrder(order.id, executionPrice!);
        broadcastToUser(order.userId, {
          type: "order_executed",
          data: {
            orderId: order.id,
            symbol: order.product.symbol,
            orderType: order.orderType,
            executionPrice: executionPrice!,
            lotSize: order.lotSize,
            type: order.type,
          }
        });
      } catch {}
    }
  }
}

async function checkMarginLiquidation() {
  try {
    const openOrders = await storage.getAllOpenOrders();
    if (!openOrders || openOrders.length === 0) return;

    const userOrders = new Map<string, typeof openOrders>();
    for (const o of openOrders) {
      if (!userOrders.has(o.userId)) userOrders.set(o.userId, []);
      userOrders.get(o.userId)!.push(o);
    }

    for (const [userId, orders] of userOrders.entries()) {
      try {
        const account = await storage.getAccount(userId);
        const leverage = account.leverage || 100;
        const balance = Number(account.balance);

        let totalPnl = 0;
        let marginUsed = 0;
        let worstOrder: { id: number; pnl: number; productId: number; symbol: string; type: string } | null = null;
        const usdJpyCached = priceCache.get(3);
        const usdJpyRate = usdJpyCached?.bid ?? 145;

        for (const o of orders) {
          const cached = priceCache.get(o.productId);
          if (!cached) continue;
          const currentP = o.type === "buy" ? cached.bid : cached.ask;
          const pnl = calculatePnL(o.product.symbol, o.type, o.price, currentP, o.lotSize);
          totalPnl += pnl;
          const cs = getContractSize(o.product.symbol);
          const units = o.lotSize * cs;
          marginUsed += getMarginUSD(o.product.symbol, units, o.price, leverage, usdJpyRate);

          if (!worstOrder || pnl < worstOrder.pnl) {
            worstOrder = { id: o.id, pnl, productId: o.productId, symbol: o.product.symbol, type: o.type };
          }
        }

        const equity = balance + totalPnl;
        const marginLevel = marginUsed > 0 ? (equity / marginUsed) * 100 : Infinity;

        if (marginLevel < 100 && worstOrder) {
          const cached = priceCache.get(worstOrder.productId);
          if (cached) {
            const closePrice = worstOrder.type === "buy" ? cached.bid : cached.ask;
            const closed = await storage.closeOrder(worstOrder.id, closePrice, "margin_call");
            broadcastToUser(userId, {
              type: "position_closed",
              data: {
                orderId: worstOrder.id,
                symbol: worstOrder.symbol,
                reason: "margin_call",
                pnl: closed.pnl,
                closePrice,
              }
            });
          }
        }
      } catch {}
    }
  } catch {}
}

async function persistPrices() {
  for (const [id, data] of priceCache.entries()) {
    try {
      await db
        .update(products)
        .set({ currentPrice: data.currentPrice, change24h: data.change24h })
        .where(eq(products.id, id));
    } catch {}
  }
}

const TD_FETCH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes — well within free-tier daily limit
const FRANKFURTER_INTERVAL_MS = 60 * 60 * 1000;
const COINGECKO_INTERVAL_MS = 2 * 60 * 1000;

export async function startPriceEngine() {
  await initPriceCache();
  buildTwelveDataBatches();
  buildSymbolBatches();

  const tdCount = tdBatches.reduce((s, b) => s + b.length, 0);
  const polyCount = polygonSymbols.length;
  log(`Price engine: ${tdCount} symbols via Twelve Data, ${polyCount} via Polygon`);

  await seedPricesFromPolygon();

  await fetchFrankfurterForex();
  await fetchCoinGecko();

  await priceModifier.loadAll();

  tickInterval = setInterval(tick, 2000);
  persistInterval = setInterval(persistPrices, 10000);

  frankfurterInterval = setInterval(fetchFrankfurterForex, FRANKFURTER_INTERVAL_MS);
  coingeckoInterval = setInterval(fetchCoinGecko, COINGECKO_INTERVAL_MS);

  const hasTD = tdBatches.length > 0 && !!process.env.TWELVEDATA_API_KEY;

  if (hasTD) {
    fetchInterval = setInterval(fetchTwelveData, TD_FETCH_INTERVAL_MS);
  }

  log(`Price engine started (2s tick, Frankfurter 60min, CoinGecko 2min, TD ${hasTD ? "15min" : "off"}, 10s persist)`);
}
