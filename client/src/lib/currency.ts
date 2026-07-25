export function formatUSD(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = "$" + abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return amount < 0 ? "-" + formatted : formatted;
}
