/**
 * Normalize phone numbers to E.164 for Firebase Auth (and Stripe).
 * Defaults to Switzerland (+41) when the user enters a national number like 078 757 59 93.
 */
export function normalizePhoneToE164(
  raw: string,
  defaultCountry: "CH" | "FR" | "DE" | "IT" | "AT" | "US" = "CH"
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/[^\d+]/g, "");
  if (!digits) return null;

  const countryDial: Record<typeof defaultCountry, string> = {
    CH: "41",
    FR: "33",
    DE: "49",
    IT: "39",
    AT: "43",
    US: "1",
  };
  const dial = countryDial[defaultCountry];

  let candidate = digits;
  if (candidate.startsWith("00")) {
    candidate = `+${candidate.slice(2)}`;
  } else if (!candidate.startsWith("+")) {
    if (candidate.startsWith(dial)) {
      candidate = `+${candidate}`;
    } else if (candidate.startsWith("0")) {
      candidate = `+${dial}${candidate.slice(1)}`;
    } else {
      candidate = `+${dial}${candidate}`;
    }
  }

  // E.164: + followed by 8–15 digits total after +
  if (!/^\+[1-9]\d{7,14}$/.test(candidate)) {
    throw Object.assign(
      new Error(
        `Phone number must be E.164 (e.g. +41 78 757 59 93). Got: ${trimmed}`
      ),
      { status: 400, code: "invalid_phone" }
    );
  }
  return candidate;
}
