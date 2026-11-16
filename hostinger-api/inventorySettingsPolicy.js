export const DEFAULT_LOW_STOCK_THRESHOLD = 5;
export const MIN_LOW_STOCK_THRESHOLD = 0;
export const MAX_LOW_STOCK_THRESHOLD = 10000;

export function validateLowStockThreshold(value) {
  const threshold = Number(value);
  if (!Number.isInteger(threshold) || threshold < MIN_LOW_STOCK_THRESHOLD || threshold > MAX_LOW_STOCK_THRESHOLD) {
    return { valid: false, error: `Low-stock threshold must be a whole number from ${MIN_LOW_STOCK_THRESHOLD} to ${MAX_LOW_STOCK_THRESHOLD}.` };
  }
  return { valid: true, value: threshold };
}
