/** Project-wide currency (Ghana Cedis). */
export const CURRENCY_CODE = 'GHS';
export const CURRENCY_SYMBOL = 'GH₵';

export function formatMoney(amount) {
  return `${CURRENCY_SYMBOL}${Number(amount || 0).toLocaleString('en-GH')}`;
}

export function formatMoneyCompact(amount) {
  const n = Number(amount || 0);
  if (n >= 1000) return `${CURRENCY_SYMBOL}${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return formatMoney(n);
}
