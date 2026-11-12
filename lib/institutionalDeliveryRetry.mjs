/**
 * Bounded retry policy for transient institutional notification failures.
 * Permanent authorization failures must be marked skipped, not retried.
 */
export function nextInstitutionalDeliveryRetry({
  retryCount,
  now = new Date(),
  errorKind = 'transient',
}) {
  if (errorKind !== 'transient') return null;
  if (!Number.isInteger(retryCount) || retryCount < 0 || retryCount >= 5) return null;
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid retry time');
  const delayMinutes = Math.min(15 * 2 ** retryCount, 240);
  return new Date(date.getTime() + delayMinutes * 60_000).toISOString();
}
