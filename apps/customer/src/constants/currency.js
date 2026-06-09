export function formatMoney(amount) {
  if (amount == null) return 'GH₵0.00';
  return `GH₵${Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function formatMoneyCompact(amount) {
  if (amount == null) return 'GH₵0';
  const n = Number(amount);
  if (n >= 1000) return `GH₵${(n / 1000).toFixed(1)}k`;
  return `GH₵${Math.round(n)}`;
}
