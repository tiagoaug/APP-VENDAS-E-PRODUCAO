/**
 * Parses a number that may be formatted with Brazilian locale (comma as decimal separator).
 * Returns 0 for null, undefined, empty string, or NaN.
 */
export function parseLocaleNumber(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const normalized = String(val).replace(',', '.');
  const num = Number(normalized);
  return isNaN(num) ? 0 : num;
}

/**
 * Formats a number as Brazilian currency string (e.g. 1234.5 → "1.234,50").
 */
export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
