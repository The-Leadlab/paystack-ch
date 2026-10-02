export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export { DEPLOYMENT_URLS } from "./deploymentUrls";

/** Public contact + outreach reply-to (verified on paystack.ch). */
export const PLATFORM_CONTACT_EMAIL = "lucas@paystack.ch";
export const PLATFORM_FROM = `Lucas | Paystack <${PLATFORM_CONTACT_EMAIL}>`;

/** Marketing mail uses system font stacks. Do not load fonts.googleapis.com (visitor IP leak). */
export const PLATFORM_FONTS_HREF = "";
export const PLATFORM_POSTAL_ADDRESS = "Paystack.ch, Geneva, Switzerland";
export const PLATFORM_UNSUBSCRIBE_URL = "https://www.paystack.ch/unsubscribe";
export const FONT_DISPLAY = "'Sora', system-ui, -apple-system, 'Segoe UI', sans-serif";
export const FONT_BODY = "'Source Serif 4', Georgia, 'Times New Roman', serif";
export const FONT_UI = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";
export const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";
