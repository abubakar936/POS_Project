export const MAX_MONEY_CENTS = 99999999999999n;

export function parseScaledDecimal(value: string, scale: number): bigint {
  const [whole, fraction = ''] = value.split('.');
  return (
    BigInt(whole) * 10n ** BigInt(scale) +
    BigInt(fraction.padEnd(scale, '0') || '0')
  );
}

export function formatScaledDecimal(value: bigint, scale: number): string {
  const factor = 10n ** BigInt(scale);
  const whole = value / factor;
  const fraction = (value % factor).toString().padStart(scale, '0');
  return scale > 0 ? `${whole}.${fraction}` : whole.toString();
}

export function calculateLineTotal(
  salePriceCents: bigint,
  quantityHundredths: bigint,
  discountCents: bigint,
): bigint {
  const grossCents = (salePriceCents * quantityHundredths + 50n) / 100n;
  return grossCents - discountCents;
}
