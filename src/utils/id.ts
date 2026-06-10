/**
 * Generates a unique ID using crypto.randomUUID when available,
 * falling back to a timestamp + random combination.
 * Replaces scattered Math.random().toString(36) calls.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}
