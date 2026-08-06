/**
 * Personal plan Stripe add-ons: extra seats (CHF 5) and doc pack (CHF 8 → 100 docs).
 */
import type Stripe from "stripe";
import {
  PERSONAL_DOC_PACK_CHF,
  PERSONAL_DOC_PACK_LIMIT,
  PERSONAL_EXTRA_SEAT_CHF,
  stripePriceIdForPersonalDocPack,
  stripePriceIdForPersonalSeat,
} from "../shared/planCatalog.js";

export type PersonalAddonKind = "seat" | "doc_pack";

const LOOKUP: Record<PersonalAddonKind, string> = {
  seat: "paystack_personal_seat_chf",
  doc_pack: "paystack_personal_doc_pack_chf",
};

function parseChfAmount(raw: string): number | null {
  const normalized = raw.trim().replace(/^CHF\s*/i, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

function addonDisplayName(kind: PersonalAddonKind): string {
  return kind === "seat" ? "Paystack Personal Extra Seat" : "Paystack Personal Doc Pack (100/mo)";
}

function rawEnvForAddon(kind: PersonalAddonKind, useTestPrices: boolean): string | null {
  return kind === "seat"
    ? stripePriceIdForPersonalSeat(useTestPrices)
    : stripePriceIdForPersonalDocPack(useTestPrices);
}

/** Resolve a recurring CHF Price ID (env price_… or create via lookup_key from numeric CHF). */
export async function resolvePersonalAddonPriceId(
  stripe: Stripe,
  kind: PersonalAddonKind,
  useTestPrices = false
): Promise<string> {
  const raw = rawEnvForAddon(kind, useTestPrices)?.trim() || null;
  if (!raw) {
    throw Object.assign(
      new Error(
        kind === "seat"
          ? "Set STRIPE_PRICE_PERSONAL_SEAT (price_… or 5)."
          : "Set STRIPE_PRICE_PERSONAL_DOC_PACK (price_… or 8)."
      ),
      { status: 503 }
    );
  }
  if (raw.startsWith("price_")) return raw;

  const lookupKey = LOOKUP[kind];
  const listed = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (listed.data[0]?.id) return listed.data[0].id;

  const unitAmount =
    parseChfAmount(raw) ??
    (kind === "seat" ? PERSONAL_EXTRA_SEAT_CHF * 100 : PERSONAL_DOC_PACK_CHF * 100);

  const product = await stripe.products.create({
    name: addonDisplayName(kind),
    metadata: { paystackAddon: kind },
  });
  const price = await stripe.prices.create({
    currency: "chf",
    unit_amount: unitAmount,
    recurring: { interval: "month" },
    product: product.id,
    lookup_key: lookupKey,
    transfer_lookup_key: true,
    metadata: { paystackAddon: kind },
  });
  return price.id;
}

function itemAddonKind(item: Stripe.SubscriptionItem): PersonalAddonKind | null {
  const meta =
    (typeof item.price !== "string" && item.price?.metadata?.paystackAddon) ||
    (typeof item.price !== "string" &&
      item.price?.product &&
      typeof item.price.product === "object" &&
      "metadata" in item.price.product &&
      (item.price.product as Stripe.Product).metadata?.paystackAddon);
  if (meta === "seat" || meta === "personal_seat") return "seat";
  if (meta === "doc_pack" || meta === "personal_doc_pack") return "doc_pack";

  const name =
    (typeof item.price !== "string" && item.price?.nickname) ||
    (typeof item.price !== "string" &&
      item.price?.product &&
      typeof item.price.product === "object" &&
      "name" in item.price.product
      ? String((item.price.product as Stripe.Product).name || "")
      : "");
  if (/extra\s*seat/i.test(name) || /personal.*seat/i.test(name)) return "seat";
  if (/doc\s*pack/i.test(name) || /100\/mo/i.test(name)) return "doc_pack";
  return null;
}

export type PersonalAddonState = {
  personalAddonSeats: number;
  personalDocPack: boolean;
  maxPersonalDocumentsPerMonth: number | null;
};

/** Derive personal add-on state from Stripe subscription line items. */
export function personalAddonsFromSubscription(
  subscription: Stripe.Subscription,
  basePersonalDocs: number | null
): PersonalAddonState {
  let seats = 0;
  let docPack = false;
  for (const item of subscription.items?.data || []) {
    const kind = itemAddonKind(item);
    if (kind === "seat") seats += item.quantity ?? 1;
    if (kind === "doc_pack") docPack = true;
  }
  return {
    personalAddonSeats: seats,
    personalDocPack: docPack,
    maxPersonalDocumentsPerMonth: docPack
      ? PERSONAL_DOC_PACK_LIMIT
      : basePersonalDocs,
  };
}

export async function matchAddonPriceIds(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  useTestPrices: boolean
): Promise<PersonalAddonState & { seatPriceId: string; docPackPriceId: string }> {
  const seatPriceId = await resolvePersonalAddonPriceId(stripe, "seat", useTestPrices);
  const docPackPriceId = await resolvePersonalAddonPriceId(stripe, "doc_pack", useTestPrices);
  let seats = 0;
  let docPack = false;
  for (const item of subscription.items?.data || []) {
    const priceId = typeof item.price === "string" ? item.price : item.price?.id;
    if (priceId === seatPriceId) seats += item.quantity ?? 1;
    else if (priceId === docPackPriceId) docPack = true;
    else {
      const kind = itemAddonKind(item);
      if (kind === "seat") seats += item.quantity ?? 1;
      if (kind === "doc_pack") docPack = true;
    }
  }
  return {
    personalAddonSeats: seats,
    personalDocPack: docPack,
    maxPersonalDocumentsPerMonth: docPack ? PERSONAL_DOC_PACK_LIMIT : null,
    seatPriceId,
    docPackPriceId,
  };
}
