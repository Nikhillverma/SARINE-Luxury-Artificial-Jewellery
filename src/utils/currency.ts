/// <reference types="vite/client" />

/**
 * Format currency utility for SARINE.
 * Provides resilient Indian Rupee formatting (e.g. 1499 -> "₹1,499").
 */

export const PRICE_UNAVAILABLE = 'Price unavailable';

// Reusable module-level formatters with Indian number grouping (e.g. 1,00,000)
const inrIntegerFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

const inrDecimalFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/**
 * Formats an amount in INR (whole rupees or decimal) to an Indian Rupee string.
 * Example: 1499 -> "₹1,499", 299 -> "₹299"
 */
export function formatInr(rupees: number): string {
  const normalised = Object.is(rupees, -0) ? 0 : rupees;

  if (typeof normalised !== 'number' || Number.isNaN(normalised) || normalised < 0) {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.warn(`[formatInr] Invalid rupee amount received: ${String(rupees)}`);
    }
    return PRICE_UNAVAILABLE;
  }

  const hasFraction = normalised % 1 !== 0;
  const formatter = hasFraction ? inrDecimalFormatter : inrIntegerFormatter;
  return `₹${formatter.format(normalised)}`;
}

/**
 * Formats an amount in Indian paise (e.g. 149900 -> "₹1,499").
 */
export function formatPaiseToInr(paise: number): string {
  const normalised = Object.is(paise, -0) ? 0 : paise;

  if (!Number.isSafeInteger(normalised) || normalised < 0) {
    return PRICE_UNAVAILABLE;
  }

  return formatInr(normalised / 100);
}
