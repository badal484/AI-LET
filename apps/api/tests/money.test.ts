import { describe, it, expect } from 'vitest';
import { Money } from '../src/modules/billing/domain/Money.js';

describe('Money Domain & Integer Minor Units', () => {
  it('instantiates correctly with integer minor units', () => {
    const m = new Money(999, 'USD');
    expect(m.amountMinorUnits).toBe(999);
    expect(m.currency).toBe('USD');
    expect(m.toMajorUnits()).toBe(9.99);
    expect(m.format()).toBe('$9.99');
  });

  it('formats multi-currency minor units correctly', () => {
    const usd = new Money(1999, 'USD');
    expect(usd.format()).toBe('$19.99');

    const inr = new Money(149900, 'INR');
    expect(inr.toMajorUnits()).toBe(1499);
    expect(inr.format()).toContain('1,499');

    const eur = new Money(1495, 'EUR');
    expect(eur.toMajorUnits()).toBe(14.95);
    expect(eur.format()).toMatch(/14[,.]95/);

    const gbp = new Money(1250, 'GBP');
    expect(gbp.format()).toBe('£12.50');
  });

  it('rejects floating point amounts or non-integer minor units', () => {
    expect(() => new Money(9.99, 'USD')).toThrow(/integers in minor units/i);
    expect(() => new Money(-500, 'USD')).toThrow(/cannot be negative/i);
  });

  it('performs exact addition and subtraction without floating point inaccuracies', () => {
    const m1 = new Money(1000, 'USD'); // $10.00
    const m2 = new Money(250, 'USD');  // $2.50

    const sum = m1.add(m2);
    expect(sum.amountMinorUnits).toBe(1250);
    expect(sum.format()).toBe('$12.50');

    const diff = m1.subtract(m2);
    expect(diff.amountMinorUnits).toBe(750);
    expect(diff.format()).toBe('$7.50');
  });

  it('prevents subtraction resulting in negative balances', () => {
    const m1 = new Money(500, 'USD');
    const m2 = new Money(1000, 'USD');

    expect(() => m1.subtract(m2)).toThrow(/negative/i);
  });

  it('prevents currency mixing operations', () => {
    const usd = new Money(1000, 'USD');
    const inr = new Money(100000, 'INR');

    expect(() => usd.add(inr)).toThrow(/different currencies/i);
    expect(() => usd.subtract(inr)).toThrow(/different currencies/i);
  });

  it('calculates deterministic integer percentage discounts', () => {
    const original = new Money(1999, 'USD'); // $19.99 = 1999 minor units
    // 20% discount: 1999 * 0.20 = 399.8 => 400 minor units discount
    const discounted = original.applyDiscountPercent(20);
    expect(discounted.amountMinorUnits).toBe(1599); // $15.99
    expect(discounted.format()).toBe('$15.99');
  });

  it('creates zero instances', () => {
    const zero = Money.zero('USD');
    expect(zero.amountMinorUnits).toBe(0);
    expect(zero.isZero()).toBe(true);
    expect(zero.format()).toBe('$0.00');
  });
});
