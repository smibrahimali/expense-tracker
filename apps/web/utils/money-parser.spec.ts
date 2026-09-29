import { parseAmountToMinorUnits } from './money-parser';
import { describe, it, expect } from 'vitest';

describe('parseAmountToMinorUnits', () => {
  it('converts a whole number string to minor units', () => {
    expect(parseAmountToMinorUnits('1500')).toBe(150000);
  });

  it('converts a single decimal place correctly ("1.5" becomes 150)', () => {
    expect(parseAmountToMinorUnits('1.5')).toBe(150);
  });

  it('converts two decimal places correctly', () => {
    expect(parseAmountToMinorUnits('1250.50')).toBe(125050);
  });

  it('rejects more than two decimal places ("12.345" is rejected)', () => {
    expect(() => parseAmountToMinorUnits('12.345')).toThrow();
  });

  it('rejects negative numbers', () => {
    expect(() => parseAmountToMinorUnits('-100')).toThrow();
  });

  it('rejects non-numeric characters', () => {
    expect(() => parseAmountToMinorUnits('100abc')).toThrow();
  });
});