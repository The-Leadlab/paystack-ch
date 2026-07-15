/** Hide Stripe sandbox / env misconfig messages from customer-facing checkout UI. */
export function isInternalStripeSandboxMessage(message: string): boolean {
  return /sandbox|stripe_test|VITE_STRIPE|STRIPE_USE_TEST|sk_test|test mode|test keys/i.test(message);
}

export function formatCustomerCheckoutError(
  err: unknown,
  t: (key: string) => string,
  fallbackKey = "subscriptionCheckoutUnavailable"
): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (isInternalStripeSandboxMessage(msg)) {
    return t(fallbackKey);
  }
  return msg || t(fallbackKey);
}
