const WHOLE_QUANTITY_UNITS = new Set(['pcs', 'dozen', 'box', 'pack', 'carton', 'pair']);

export function isWholeQuantityUnit(unit?: string | null): boolean {
  return WHOLE_QUANTITY_UNITS.has(unit?.trim().toLowerCase() ?? '');
}

export function isValidQuantityForUnit(
  quantity: string,
  unit?: string | null,
): boolean {
  if (!isWholeQuantityUnit(unit)) return true;
  const fraction = quantity.split('.')[1];
  return !fraction || /^0+$/.test(fraction);
}
