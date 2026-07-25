import { getInstrument } from "./instrumentRegistry";

export function getPipSize(symbol: string): number {
  return getInstrument(symbol).pipSize;
}

export function getPipValue(symbol: string): number {
  return getInstrument(symbol).pipValue;
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
