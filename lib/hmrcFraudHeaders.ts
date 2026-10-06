/**
 * Pure builders for HMRC MTD fraud-prevention headers (Gov-Client-* / Gov-Vendor-*).
 * Unit-testable — no I/O. Client supplies device/browser facts; server adds connection metadata.
 */

export type HmrcClientFraudPayload = {
  /** Public IP as seen by the client (optional; server may override). */
  publicIp?: string;
  /** Device ID stable for the browser profile (UUID). */
  deviceId?: string;
  /** Browser user-agent string. */
  userAgent?: string;
  /** Timezone offset minutes (JS getTimezoneOffset). */
  timezone?: number;
  /** Screen width x height, e.g. "1920x1080". */
  screens?: string;
  /** Window width x height. */
  windowSize?: string;
  /** List of plugins / mime types (comma-separated or array). */
  plugins?: string | string[];
  /** Local IPs if WebRTC enumeration ran (comma-separated or array). */
  localIps?: string | string[];
  /** MAC addresses if available (rare in browsers). */
  macAddresses?: string | string[];
  /** Multi-factor auth status code per HMRC (e.g. "false"). */
  multiFactor?: string;
  /** Vendor product name override. */
  vendorProductName?: string;
  /** Vendor version override. */
  vendorVersion?: string;
  /** Vendor public IP (server-side product egress). */
  vendorPublicIp?: string;
  /** Vendor license IDs. */
  vendorLicenseIds?: string | string[];
};

export type HmrcServerRequestInfo = {
  /** Connecting IP from X-Forwarded-For / req.socket. */
  clientIp?: string;
  /** Raw request User-Agent if client omitted one. */
  userAgent?: string;
  /** Vendor / app identity defaults. */
  vendorProductName?: string;
  vendorVersion?: string;
  vendorPublicIp?: string;
  vendorLicenseIds?: string | string[];
  /** Connection method, e.g. "WEB_APP_VIA_SERVER". */
  connectionMethod?: string;
};

function csv(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) {
    const joined = value.map((v) => String(v).trim()).filter(Boolean).join(",");
    return joined || undefined;
  }
  const s = String(value).trim();
  return s || undefined;
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

/** Prefer first hop of X-Forwarded-For, else provided fallback. */
export function resolveClientIp(
  forwardedFor: string | string[] | undefined,
  fallback?: string
): string | undefined {
  const xf = firstHeaderValue(forwardedFor);
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  return fallback?.trim() || undefined;
}

/**
 * Build Gov-Client-* and Gov-Vendor-* headers for an HMRC MTD API call.
 * Only includes defined values — callers can merge with Authorization separately.
 */
export function buildHmrcFraudHeaders(
  client: HmrcClientFraudPayload = {},
  server: HmrcServerRequestInfo = {}
): Record<string, string> {
  const headers: Record<string, string> = {};

  const publicIp = client.publicIp?.trim() || server.clientIp?.trim();
  if (publicIp) headers["Gov-Client-Public-IP"] = publicIp;

  if (client.deviceId?.trim()) headers["Gov-Client-Device-ID"] = client.deviceId.trim();

  const ua = client.userAgent?.trim() || server.userAgent?.trim();
  if (ua) headers["Gov-Client-User-Agent"] = ua;

  if (typeof client.timezone === "number" && Number.isFinite(client.timezone)) {
    headers["Gov-Client-Timezone"] = `UTC${client.timezone <= 0 ? "+" : "-"}${Math.abs(client.timezone)}`;
  }

  if (client.screens?.trim()) headers["Gov-Client-Screens"] = client.screens.trim();
  if (client.windowSize?.trim()) headers["Gov-Client-Window-Size"] = client.windowSize.trim();

  const plugins = csv(client.plugins);
  if (plugins) headers["Gov-Client-Browser-Plugins"] = plugins;

  const localIps = csv(client.localIps);
  if (localIps) headers["Gov-Client-Local-IPs"] = localIps;

  const macs = csv(client.macAddresses);
  if (macs) headers["Gov-Client-MAC-Addresses"] = macs;

  if (client.multiFactor?.trim()) {
    headers["Gov-Client-Multi-Factor"] = client.multiFactor.trim();
  }

  const connectionMethod = server.connectionMethod?.trim() || "WEB_APP_VIA_SERVER";
  headers["Gov-Client-Connection-Method"] = connectionMethod;

  const productName =
    client.vendorProductName?.trim() || server.vendorProductName?.trim() || "Paystack";
  headers["Gov-Vendor-Product-Name"] = productName;

  const version = client.vendorVersion?.trim() || server.vendorVersion?.trim();
  if (version) headers["Gov-Vendor-Version"] = version;

  const vendorIp = client.vendorPublicIp?.trim() || server.vendorPublicIp?.trim();
  if (vendorIp) headers["Gov-Vendor-Public-IP"] = vendorIp;

  const licenseIds = csv(client.vendorLicenseIds) || csv(server.vendorLicenseIds);
  if (licenseIds) headers["Gov-Vendor-License-IDs"] = licenseIds;

  return headers;
}
