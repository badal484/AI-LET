import { PriceCurrency } from '@ai-companion/types';
import { BadRequestError } from '../../../shared/errors/AppError.js';

export interface FormattedMoney {
  amountMinorUnits: number;
  currency: PriceCurrency;
  formatted: string;
}

export class Money {
  public readonly amountMinorUnits: number;
  public readonly currency: PriceCurrency;

  constructor(amountMinorUnits: number, currency: PriceCurrency = 'USD') {
    if (!Number.isInteger(amountMinorUnits)) {
      throw new BadRequestError(`Monetary amounts must be stored as integers in minor units, received: ${amountMinorUnits}`);
    }
    if (amountMinorUnits < 0) {
      throw new BadRequestError(`Monetary amount cannot be negative: ${amountMinorUnits}`);
    }
    this.amountMinorUnits = amountMinorUnits;
    this.currency = currency;
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinorUnits + other.amountMinorUnits, this.currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    const result = this.amountMinorUnits - other.amountMinorUnits;
    if (result < 0) {
      throw new BadRequestError(`Monetary subtraction resulted in negative amount: ${result}`);
    }
    return new Money(result, this.currency);
  }

  public applyDiscountPercentage(percentage: number): Money {
    if (percentage < 0 || percentage > 100) {
      throw new BadRequestError(`Invalid discount percentage: ${percentage}`);
    }
    const discountAmount = Math.round((this.amountMinorUnits * percentage) / 100);
    const discounted = Math.max(0, this.amountMinorUnits - discountAmount);
    return new Money(discounted, this.currency);
  }

  public applyFixedDiscount(discountMinorUnits: number): Money {
    const discounted = Math.max(0, this.amountMinorUnits - discountMinorUnits);
    return new Money(discounted, this.currency);
  }

  public format(): string {
    const majorUnits = this.amountMinorUnits / 100;
    switch (this.currency) {
      case 'INR':
        return `₹${majorUnits.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
      case 'USD':
        return `$${majorUnits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'EUR':
        return `€${majorUnits.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'GBP':
        return `£${majorUnits.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      default:
        return `${this.currency} ${majorUnits.toFixed(2)}`;
    }
  }

  public toJSON(): FormattedMoney {
    return {
      amountMinorUnits: this.amountMinorUnits,
      currency: this.currency,
      formatted: this.format(),
    };
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new BadRequestError(`Cannot perform monetary operation between different currencies: ${this.currency} and ${other.currency}`);
    }
  }

  public toMajorUnits(): number {
    return this.amountMinorUnits / 100;
  }

  public isZero(): boolean {
    return this.amountMinorUnits === 0;
  }

  public applyDiscountPercent(percentage: number): Money {
    return this.applyDiscountPercentage(percentage);
  }

  public static zero(currency: PriceCurrency = 'USD'): Money {
    return new Money(0, currency);
  }

  public static fromMinor(amountMinorUnits: number, currency: PriceCurrency = 'USD'): Money {
    return new Money(amountMinorUnits, currency);
  }

  public static fromMajor(amountMajorUnits: number, currency: PriceCurrency = 'USD'): Money {
    const minor = Math.round(amountMajorUnits * 100);
    return new Money(minor, currency);
  }
}
