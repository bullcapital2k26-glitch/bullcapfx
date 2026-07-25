import { getInstrument } from "@shared/instrumentRegistry";

export function getPipSize(symbol: string): number {
  return getInstrument(symbol).pipSize;
}

export function getPipValue(symbol: string): number {
  return getInstrument(symbol).pipValue;
}

export function getMarginUSD(
  symbol: string,
  units: number,
  price: number,
  leverage: number,
  usdJpyRate?: number,
): number {
  const inst = getInstrument(symbol);
  const marginInQuote = (units * price) / leverage;

  switch (inst.marginMode) {
    case "usd_base":
      return units / leverage;
    case "jpy_quote": {
      const rate = usdJpyRate && usdJpyRate > 0 ? usdJpyRate : price;
      return marginInQuote / rate;
    }
    case "standard":
    default:
      return marginInQuote;
  }
}

export function calculatePnL(
  symbol: string,
  side: string,
  entryPrice: number,
  currentPrice: number,
  lotSize: number,
): number {
  const inst = getInstrument(symbol);
  const priceDiff =
    side === "sell" ? entryPrice - currentPrice : currentPrice - entryPrice;
  const pips = priceDiff / inst.pipSize;
  return pips * inst.pipValue * lotSize;
}
