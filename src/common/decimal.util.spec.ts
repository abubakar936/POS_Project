import {
  calculateLineTotal,
  formatScaledDecimal,
  parseScaledDecimal,
} from './decimal.util';

describe('decimal utilities', () => {
  it('parses and formats decimal amounts without floating-point arithmetic', () => {
    const amount = parseScaledDecimal('1234.56', 2);

    expect(amount).toBe(123456n);
    expect(formatScaledDecimal(amount, 2)).toBe('1234.56');
  });

  it('rounds fractional-quantity line totals to cents', () => {
    const total = calculateLineTotal(
      parseScaledDecimal('19.99', 2),
      parseScaledDecimal('1.25', 2),
      parseScaledDecimal('1.00', 2),
    );

    expect(formatScaledDecimal(total, 2)).toBe('23.99');
  });
});
