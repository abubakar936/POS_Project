const amountFormatter = new Intl.NumberFormat('en-PK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatRupees(value?: string | null): string {
  if (value === undefined || value === null || value === '') return '—';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return `Rs. ${amountFormatter.format(amount)}`;
}

export function sumDecimalAmounts(values: string[]): string {
  const cents = values.reduce((total, value) => {
    const [whole = '0', fraction = ''] = value.split('.');
    const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
    return total + amount;
  }, 0n);
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}
