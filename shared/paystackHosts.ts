/** Production custom domains — always use live Stripe unless `?stripe_test=1`. */
export function isProductionPaystackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "paystack.ch" || host === "www.paystack.ch";
}
