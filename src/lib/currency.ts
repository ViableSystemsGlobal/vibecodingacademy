import { prisma } from "./prisma";

export interface CurrencyConversion {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  convertedAmount: number;
  exchangeRate: number;
  source: string;
}

export interface ExchangeRateData {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
}

const DEFAULT_EXCHANGE_RATES: Record<string, Record<string, number>> = {
  USD: { GHS: 15 },
  EUR: { GHS: 16 },
  GBP: { GHS: 18 },
};

/**
 * Get the latest exchange rate between two currencies
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  date?: Date
): Promise<number | null> {
  try {
    if (fromCurrency === toCurrency) return 1;

    const effectiveDate = date || new Date();

    // First, try to find direct rate
    let exchangeRate = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency,
        toCurrency,
        isActive: true,
        effectiveFrom: { lte: effectiveDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: effectiveDate } }
        ]
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    // If no direct rate found, try reverse rate (inverse calculation)
    if (!exchangeRate) {
      const reverseRate = await prisma.exchangeRate.findFirst({
        where: {
          fromCurrency: toCurrency,
          toCurrency: fromCurrency,
          isActive: true,
          effectiveFrom: { lte: effectiveDate },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: effectiveDate } }
          ]
        },
        orderBy: { effectiveFrom: 'desc' }
      });

      if (reverseRate && reverseRate.rate) {
        // Calculate inverse rate
        const inverseRate = 1 / Number(reverseRate.rate);
        return Math.round(inverseRate * 10000) / 10000; // Round to 4 decimal places
      }
    }

    return exchangeRate ? Number(exchangeRate.rate) : null;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    return null;
  }
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
  fromCurrency: string,
  toCurrency: string,
  amount: number,
  date?: Date
): Promise<CurrencyConversion | null> {
  try {
    if (fromCurrency === toCurrency) {
      return {
        fromCurrency,
        toCurrency,
        amount,
        convertedAmount: amount,
        exchangeRate: 1,
        source: 'same_currency'
      };
    }

    const exchangeRate = await getExchangeRate(fromCurrency, toCurrency, date);
    
    if (!exchangeRate) {
      console.warn(`No exchange rate found for ${fromCurrency} to ${toCurrency}, using amount as-is`);

      const fallbackRate = DEFAULT_EXCHANGE_RATES[fromCurrency]?.[toCurrency];
      if (fallbackRate) {
        const convertedAmount = amount * fallbackRate;
        return {
          fromCurrency,
          toCurrency,
          amount,
          convertedAmount: Math.round(convertedAmount * 100) / 100,
          exchangeRate: fallbackRate,
          source: 'static_fallback'
        };
      }
      // Return original amount if no exchange rate found (fallback)
      return {
        fromCurrency,
        toCurrency,
        amount,
        convertedAmount: amount,
        exchangeRate: 1,
        source: 'fallback'
      };
    }

    const convertedAmount = amount * exchangeRate;

    return {
      fromCurrency,
      toCurrency,
      amount,
      convertedAmount: Math.round(convertedAmount * 100) / 100, // Round to 2 decimal places
      exchangeRate,
      source: 'database'
    };
  } catch (error) {
    console.error('Error converting currency:', error);
    return null;
  }
}

/**
 * Update exchange rate manually
 */
export async function updateExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  rate: number,
  source: string = 'manual',
  effectiveFrom?: Date,
  effectiveTo?: Date
): Promise<boolean> {
  try {
    await prisma.exchangeRate.create({
      data: {
        fromCurrency,
        toCurrency,
        rate,
        source,
        effectiveFrom: effectiveFrom || new Date(),
        effectiveTo
      }
    });

    return true;
  } catch (error) {
    console.error('Error updating exchange rate:', error);
    return false;
  }
}

/**
 * Get all supported currencies
 */
export async function getSupportedCurrencies() {
  try {
    return await prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' }
    });
  } catch (error) {
    console.error('Error fetching currencies:', error);
    return [];
  }
}

/**
 * Format currency amount with proper symbol and formatting
 */
export function formatCurrency(
  amount: number,
  currencyCode: string,
  currencySymbol?: string
): string {
  const symbol = currencySymbol || getCurrencySymbol(currencyCode);
  
  // Format number with proper decimal places
  const formattedAmount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);

  return `${symbol}${formattedAmount}`;
}

/**
 * Get currency symbol by code
 */
export function getCurrencySymbol(currencyCode: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'GHS': 'GH₵',
    'EUR': '€',
    'GBP': '£',
    'NGN': '₦',
    'KES': 'KSh',
    'ZAR': 'R',
    'EGP': 'E£',
    'MAD': 'MAD',
    'TND': 'DT'
  };

  return symbols[currencyCode] || currencyCode;
}

/**
 * Calculate product price in different currencies
 */
export async function calculateProductPrice(
  productId: string,
  targetCurrency: string,
  date?: Date
): Promise<{
  basePrice: number;
  baseCurrency: string;
  convertedPrice: number;
  targetCurrency: string;
  exchangeRate: number;
} | null> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product || !product.price) {
      return null;
    }

    const basePrice = Number(product.price);
    const baseCurrency = product.importCurrency;

    if (baseCurrency === targetCurrency) {
      return {
        basePrice,
        baseCurrency,
        convertedPrice: basePrice,
        targetCurrency,
        exchangeRate: 1
      };
    }

    const conversion = await convertCurrency(
      baseCurrency,
      targetCurrency,
      basePrice,
      date
    );

    if (!conversion) {
      return null;
    }

    return {
      basePrice,
      baseCurrency,
      convertedPrice: conversion.convertedAmount,
      targetCurrency,
      exchangeRate: conversion.exchangeRate
    };
  } catch (error) {
    console.error('Error calculating product price:', error);
    return null;
  }
}
