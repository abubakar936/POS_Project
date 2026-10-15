export const MEASURING_UNITS = [
  { value: 'pcs', label: 'Piece (pcs)' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'ml', label: 'Millilitre (ml)' },
  { value: 'L', label: 'Litre (L)' },
  { value: 'box', label: 'Box' },
  { value: 'pack', label: 'Pack' },
  { value: 'carton', label: 'Carton' },
  { value: 'pair', label: 'Pair' },
  { value: 'm', label: 'Meter (m)' },
] as const;

const WHOLE_QUANTITY_UNITS = new Set([
  'pcs',
  'dozen',
  'box',
  'pack',
  'carton',
  'pair',
]);

export function isKnownMeasuringUnit(unit: string): boolean {
  return MEASURING_UNITS.some((option) => option.value === unit);
}

export function isWholeQuantityUnit(unit?: string | null): boolean {
  return WHOLE_QUANTITY_UNITS.has(unit?.trim().toLowerCase() ?? '');
}
