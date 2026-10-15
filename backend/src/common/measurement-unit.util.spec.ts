import {
  isValidQuantityForUnit,
  isWholeQuantityUnit,
} from './measurement-unit.util';

describe('measurement unit quantity rules', () => {
  it.each(['pcs', 'dozen', 'box', 'pack', 'carton', 'pair'])(
    'requires whole quantities for %s',
    (unit) => {
      expect(isWholeQuantityUnit(unit)).toBe(true);
      expect(isValidQuantityForUnit('2', unit)).toBe(true);
      expect(isValidQuantityForUnit('2.00', unit)).toBe(true);
      expect(isValidQuantityForUnit('2.5', unit)).toBe(false);
    },
  );

  it.each(['g', 'kg', 'ml', 'L', 'm', 'custom unit', null])(
    'allows fractional quantities for %s',
    (unit) => {
      expect(isWholeQuantityUnit(unit)).toBe(false);
      expect(isValidQuantityForUnit('1.25', unit)).toBe(true);
    },
  );
});
