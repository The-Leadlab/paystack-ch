export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export { DEPLOYMENT_URLS } from "./deploymentUrls";

/** Public contact + outreach reply-to (verified on paystack.ch). */
export const PLATFORM_CONTACT_EMAIL = "lucas@paystack.ch";
export const PLATFORM_FROM = `Paystack <${PLATFORM_CONTACT_EMAIL}>`;

/** Same webfonts as `client/index.html` — Sora, Source Serif 4, Inter, JetBrains Mono. */
export const PLATFORM_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Sora:wght@400;600;700&family=Source+Serif+4:opsz,wght@8..60,400;1,8..60,400&family=JetBrains+Mono:wght@400;500&display=swap";
export const FONT_DISPLAY = "'Sora', system-ui, -apple-system, 'Segoe UI', sans-serif";
export const FONT_BODY = "'Source Serif 4', Georgia, 'Times New Roman', serif";
export const FONT_UI = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";
export const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";
