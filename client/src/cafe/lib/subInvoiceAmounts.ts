/**
 * Safe amounts for one invoice block inside a multi-invoice PDF binder.
 * Never inherit the parent binder's amountInCHF / totalAmount — that caused
 * N× binder totals on Expenses / Insights / Documents fan-out.
 */

export type AmountLike = {
  totalAmount?: number | null;
  amountInCHF?: number | null;
  conversionRateUsed?: number | null;
};

export function resolveSubInvoiceAmounts(
  sub: AmountLike,
  parent: AmountLike
): { totalAmount: number; amountInCHF: number; conversionRateUsed: number } {
  const rate =
    Number(sub.conversionRateUsed) > 0
      ? Number(sub.conversionRateUsed)
      : Number(parent.conversionRateUsed) > 0
        ? Number(parent.conversionRateUsed)
        : 1;

  const subTotal = Number(sub.totalAmount);
  const subChf = Number(sub.amountInCHF);
  const parentBinder =
    Number(parent.amountInCHF) > 0
      ? Number(parent.amountInCHF)
      : Number(parent.totalAmount) > 0
        ? Number(parent.totalAmount)
        : 0;

  const totalAmount =
    Number.isFinite(subTotal) && subTotal > 0
      ? subTotal
      : Number.isFinite(subChf) &&
          subChf > 0 &&
          !(parentBinder > 0 && Math.abs(subChf - parentBinder) < 0.02)
        ? subChf
        : 0;

  const chfLooksLikeBinder =
    parentBinder > 0 &&
    Number.isFinite(subChf) &&
    subChf > 0 &&
    Math.abs(subChf - parentBinder) < 0.02 &&
    totalAmount > 0 &&
    totalAmount + 0.02 < parentBinder;

  const amountInCHF = chfLooksLikeBinder
    ? Math.round(totalAmount * rate * 100) / 100
    : Number.isFinite(subChf) && subChf > 0 && !chfLooksLikeBinder
      ? subChf
      : Math.round(totalAmount * rate * 100) / 100;

  return { totalAmount, amountInCHF, conversionRateUsed: rate };
}

/** CHF amount to display / sum for one sub-invoice under a parent binder. */
export function resolveSubInvoiceAmountInCHF(sub: AmountLike, parent: AmountLike): number {
  return resolveSubInvoiceAmounts(sub, parent).amountInCHF;
}

/** Document-level amount (single invoice or whole binder). */
export function resolveDocumentAmountInCHF(data: AmountLike | null | undefined): number {
  if (!data) return 0;
  const chf = Number(data.amountInCHF);
  const total = Number(data.totalAmount);
  if (Number.isFinite(chf) && chf > 0) return chf;
  if (Number.isFinite(total) && total > 0) return total;
  return 0;
}
