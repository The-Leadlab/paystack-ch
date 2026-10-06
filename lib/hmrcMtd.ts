/**
 * HMRC Making Tax Digital (VAT) — sandbox-only OAuth + VAT obligations/returns.
 * Tokens live on users/{uid}.hmrcMtd via Admin SDK; refresh tokens never go to the client.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { nanoid } from "nanoid";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { ensureFirebaseAdmin, hasFirebaseAdminCredentials } from "./firebaseAdmin.js";
import { verifyFirebaseAuthorizationHeader } from "./verifyFirebaseIdToken.js";
import {
  buildHmrcFraudHeaders,
  resolveClientIp,
  type HmrcClientFraudPayload,
} from "./hmrcFraudHeaders.js";

export const HMRC_SANDBOX_BASE_URL = "https://test-api.service.hmrc.gov.uk";
const HMRC_PRODUCTION_BASE_URL = "https://api.service.hmrc.gov.uk";
const HMRC_PRODUCTION_WWW = "https://www.tax.service.gov.uk";

const HMRC_OAUTH_AUTHORIZE_PATH = "/oauth/authorize";
const HMRC_OAUTH_TOKEN_PATH = "/oauth/token";
const HMRC_VAT_SCOPE = "read:vat write:vat";

const STATE_TTL_MS = 10 * 60 * 1000;

export type HmrcMtdResult =
  | { status: number; redirectUrl: string }
  | { status: number; json: Record<string, unknown> };

export type HmrcOAuthState = { uid: string; nonce: string; expiresAt: number; returnPath?: string };

type HmrcStoredTokens = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  connectedAt?: unknown;
  vrn?: string;
  needsReconnect?: boolean;
};

function parseTruthyEnv(value: string | undefined): boolean {
  return value?.toLowerCase() === "true" || value === "1";
}

/** Server flag — all handlers must refuse when false. */
export function isHmrcMtdEnabled(): boolean {
  return parseTruthyEnv(process.env.HMRC_MTD_ENABLED);
}

function disabledResult(): HmrcMtdResult {
  return { status: 403, json: { error: "HMRC MTD is disabled" } };
}

/**
 * Resolve API base URL. Sandbox only — refuses production HMRC hosts.
 * Throws with status 503 if HMRC_ENV is production or base URL is not sandbox.
 */
export function resolveHmrcBaseUrl(
  env: string | undefined = process.env.HMRC_ENV,
  overrideBase?: string
): string {
  const envName = String(env || "sandbox").trim().toLowerCase();
  if (envName === "production" || envName === "prod" || envName === "live") {
    throw Object.assign(
      new Error("HMRC_ENV production is not allowed — sandbox only"),
      { status: 503 }
    );
  }

  const base = (overrideBase || HMRC_SANDBOX_BASE_URL).replace(/\/+$/, "");
  const lower = base.toLowerCase();
  if (
    lower.includes("www.tax.service.gov.uk") ||
    lower === HMRC_PRODUCTION_WWW ||
    lower.startsWith(HMRC_PRODUCTION_BASE_URL) ||
    (lower.includes("api.service.hmrc.gov.uk") && !lower.includes("test-api.service.hmrc.gov.uk"))
  ) {
    throw Object.assign(
      new Error("HMRC production base URL is refused — use sandbox test-api.service.hmrc.gov.uk only"),
      { status: 503 }
    );
  }
  if (base !== HMRC_SANDBOX_BASE_URL) {
    throw Object.assign(
      new Error(`HMRC base URL must be ${HMRC_SANDBOX_BASE_URL}`),
      { status: 503 }
    );
  }
  return HMRC_SANDBOX_BASE_URL;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw Object.assign(new Error(`Server missing ${name}`), { status: 503 });
  }
  return value;
}

function stateSigningSecret(): string {
  const secret = process.env.HMRC_STATE_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw Object.assign(
      new Error("HMRC_STATE_SECRET is not configured (min 16 characters)."),
      { status: 503 }
    );
  }
  return secret;
}

/** Safe in-app path for post-OAuth redirect. */
export function sanitizeHmrcReturnPath(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) return undefined;
  if (path.length > 200 || /[\s<>"]/.test(path)) return undefined;
  return path.split("?")[0] || undefined;
}

/** HMAC-signed state (same pattern as Google Drive OAuth). */
export function createHmrcOAuthState(uid: string, returnPath?: string): string {
  const safeReturn = sanitizeHmrcReturnPath(returnPath);
  const payload = JSON.stringify({
    uid,
    nonce: nanoid(),
    expiresAt: Date.now() + STATE_TTL_MS,
    ...(safeReturn ? { returnPath: safeReturn } : {}),
  } satisfies HmrcOAuthState);
  const sig = createHmac("sha256", stateSigningSecret()).update(payload).digest("base64url");
  return Buffer.from(JSON.stringify({ payload, sig }), "utf8").toString("base64url");
}

export function decodeHmrcOAuthState(state: string): HmrcOAuthState {
  const invalid = () => Object.assign(new Error("Invalid or expired state parameter"), { status: 400 });

  let parsed: { payload?: string; sig?: string };
  try {
    parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    throw invalid();
  }
  if (!parsed.payload || !parsed.sig) throw invalid();

  const expectedSig = createHmac("sha256", stateSigningSecret()).update(parsed.payload).digest("base64url");
  const provided = Buffer.from(parsed.sig);
  const expected = Buffer.from(expectedSig);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw invalid();
  }

  const inner = JSON.parse(parsed.payload) as HmrcOAuthState;
  if (!inner.uid || !inner.nonce || typeof inner.expiresAt !== "number") throw invalid();
  if (inner.expiresAt < Date.now()) throw invalid();

  const returnPath = sanitizeHmrcReturnPath(inner.returnPath);
  return returnPath
    ? { ...inner, returnPath }
    : { uid: inner.uid, nonce: inner.nonce, expiresAt: inner.expiresAt };
}

export async function startHmrcOAuth(
  authorization: string | undefined,
  body?: { returnPath?: unknown }
): Promise<HmrcMtdResult> {
  if (!isHmrcMtdEnabled()) return disabledResult();

  let uid: string;
  try {
    uid = await verifyFirebaseAuthorizationHeader(authorization);
  } catch (error) {
    const status = (error as { status?: number }).status || 401;
    return { status, json: { error: (error as Error).message } };
  }

  try {
    const base = resolveHmrcBaseUrl();
    const authUrl = new URL(`${base}${HMRC_OAUTH_AUTHORIZE_PATH}`);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", requireEnv("HMRC_CLIENT_ID"));
    authUrl.searchParams.set("scope", HMRC_VAT_SCOPE);
    authUrl.searchParams.set("redirect_uri", requireEnv("HMRC_REDIRECT_URI"));
    authUrl.searchParams.set(
      "state",
      createHmrcOAuthState(uid, sanitizeHmrcReturnPath(body?.returnPath))
    );
    return { status: 302, redirectUrl: authUrl.toString() };
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return { status, json: { error: (error as Error).message } };
  }
}

type HmrcTokenExchange = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
};

async function exchangeHmrcAuthCode(code: string): Promise<HmrcTokenExchange> {
  const base = resolveHmrcBaseUrl();
  const res = await fetch(`${base}${HMRC_OAUTH_TOKEN_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: requireEnv("HMRC_CLIENT_ID"),
      client_secret: requireEnv("HMRC_CLIENT_SECRET"),
      redirect_uri: requireEnv("HMRC_REDIRECT_URI"),
    }).toString(),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw Object.assign(
      new Error(data.error_description || data.error || "Failed to exchange HMRC authorization code"),
      { status: 400 }
    );
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in ?? 14400,
    token_type: data.token_type,
    scope: data.scope,
  };
}

async function storeHmrcConnection(
  uid: string,
  tokens: { accessToken: string; refreshToken: string; expiresAt: number }
): Promise<void> {
  ensureFirebaseAdmin();
  await getFirestore()
    .collection("users")
    .doc(uid)
    .set(
      {
        hmrcMtd: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          connectedAt: FieldValue.serverTimestamp(),
          needsReconnect: false,
        },
      },
      { merge: true }
    );
}

export async function completeHmrcOAuth(code: string, state: string): Promise<HmrcMtdResult> {
  if (!isHmrcMtdEnabled()) return disabledResult();

  try {
    const { uid } = decodeHmrcOAuthState(state);
    const tokens = await exchangeHmrcAuthCode(code);
    if (!tokens.refresh_token) {
      throw Object.assign(
        new Error("HMRC did not return a refresh token. Reconnect and grant consent again."),
        { status: 502 }
      );
    }
    if (!hasFirebaseAdminCredentials()) {
      throw Object.assign(new Error("Server missing Firebase Admin credentials"), { status: 503 });
    }
    await storeHmrcConnection(uid, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    });
    return { status: 200, json: { connected: true } };
  } catch (error) {
    const status = (error as { status?: number }).status || 400;
    return { status, json: { error: (error as Error).message } };
  }
}

async function loadHmrcMtd(uid: string): Promise<HmrcStoredTokens | null> {
  ensureFirebaseAdmin();
  const snap = await getFirestore().collection("users").doc(uid).get();
  const hmrcMtd = (snap.data() as { hmrcMtd?: HmrcStoredTokens } | undefined)?.hmrcMtd;
  return hmrcMtd && typeof hmrcMtd === "object" ? hmrcMtd : null;
}

export async function getHmrcStatus(authorization: string | undefined): Promise<HmrcMtdResult> {
  if (!isHmrcMtdEnabled()) return disabledResult();

  let uid: string;
  try {
    uid = await verifyFirebaseAuthorizationHeader(authorization);
  } catch (error) {
    const status = (error as { status?: number }).status || 401;
    return { status, json: { error: (error as Error).message } };
  }

  try {
    if (!hasFirebaseAdminCredentials()) {
      throw Object.assign(new Error("Server missing Firebase Admin credentials"), { status: 503 });
    }
    const hmrcMtd = await loadHmrcMtd(uid);
    const connected = typeof hmrcMtd?.refreshToken === "string";
    return {
      status: 200,
      json: {
        connected,
        needsReconnect: hmrcMtd?.needsReconnect === true,
        // Never expose tokens to the client
        vrn: typeof hmrcMtd?.vrn === "string" ? hmrcMtd.vrn : null,
      },
    };
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return { status, json: { error: (error as Error).message } };
  }
}

async function deleteHmrcConnection(uid: string): Promise<void> {
  ensureFirebaseAdmin();
  await getFirestore()
    .collection("users")
    .doc(uid)
    .set({ hmrcMtd: FieldValue.delete() }, { merge: true });
}

export async function disconnectHmrc(authorization: string | undefined): Promise<HmrcMtdResult> {
  if (!isHmrcMtdEnabled()) return disabledResult();

  let uid: string;
  try {
    uid = await verifyFirebaseAuthorizationHeader(authorization);
  } catch (error) {
    const status = (error as { status?: number }).status || 401;
    return { status, json: { error: (error as Error).message } };
  }

  try {
    if (!hasFirebaseAdminCredentials()) {
      throw Object.assign(new Error("Server missing Firebase Admin credentials"), { status: 503 });
    }
    await deleteHmrcConnection(uid);
    return { status: 200, json: { connected: false } };
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return { status, json: { error: (error as Error).message } };
  }
}

async function refreshHmrcAccessToken(uid: string, refreshToken: string): Promise<string> {
  const base = resolveHmrcBaseUrl();
  const res = await fetch(`${base}${HMRC_OAUTH_TOKEN_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: requireEnv("HMRC_CLIENT_ID"),
      client_secret: requireEnv("HMRC_CLIENT_SECRET"),
    }).toString(),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    ensureFirebaseAdmin();
    await getFirestore()
      .collection("users")
      .doc(uid)
      .set({ hmrcMtd: { needsReconnect: true } }, { merge: true });
    throw Object.assign(
      new Error(data.error_description || data.error || "HMRC token refresh failed"),
      { status: 401 }
    );
  }

  const nextRefresh = data.refresh_token || refreshToken;
  const expiresAt = Date.now() + (data.expires_in ?? 14400) * 1000;
  ensureFirebaseAdmin();
  await getFirestore()
    .collection("users")
    .doc(uid)
    .set(
      {
        hmrcMtd: {
          accessToken: data.access_token,
          refreshToken: nextRefresh,
          expiresAt,
          needsReconnect: false,
        },
      },
      { merge: true }
    );

  return data.access_token;
}

async function getValidAccessToken(uid: string): Promise<string> {
  const hmrcMtd = await loadHmrcMtd(uid);
  if (typeof hmrcMtd?.refreshToken !== "string") {
    throw Object.assign(new Error("HMRC MTD is not connected"), { status: 401 });
  }
  const expiresAt = typeof hmrcMtd.expiresAt === "number" ? hmrcMtd.expiresAt : 0;
  if (typeof hmrcMtd.accessToken === "string" && expiresAt > Date.now() + 60_000) {
    return hmrcMtd.accessToken;
  }
  return refreshHmrcAccessToken(uid, hmrcMtd.refreshToken);
}

function normalizeVrn(raw: unknown): string {
  const vrn = String(raw ?? "").replace(/\s+/g, "");
  if (!/^\d{9}$/.test(vrn)) {
    throw Object.assign(new Error("VRN must be 9 digits"), { status: 400 });
  }
  return vrn;
}

type VatCallOpts = {
  authorization: string | undefined;
  vrn: unknown;
  fraudClient?: HmrcClientFraudPayload;
  serverRequest?: {
    forwardedFor?: string | string[];
    userAgent?: string;
    clientIp?: string;
  };
};

async function authorizeVatCall(opts: VatCallOpts): Promise<{ uid: string; accessToken: string; vrn: string; fraudHeaders: Record<string, string> }> {
  const uid = await verifyFirebaseAuthorizationHeader(opts.authorization);
  if (!hasFirebaseAdminCredentials()) {
    throw Object.assign(new Error("Server missing Firebase Admin credentials"), { status: 503 });
  }
  const vrn = normalizeVrn(opts.vrn);
  const accessToken = await getValidAccessToken(uid);
  const clientIp = resolveClientIp(opts.serverRequest?.forwardedFor, opts.serverRequest?.clientIp);
  const fraudHeaders = buildHmrcFraudHeaders(opts.fraudClient || {}, {
    clientIp,
    userAgent: opts.serverRequest?.userAgent,
    vendorProductName: "Paystack",
    connectionMethod: "WEB_APP_VIA_SERVER",
  });
  return { uid, accessToken, vrn, fraudHeaders };
}

/** GET sandbox VAT obligations for a VRN. */
export async function getVatObligations(
  authorization: string | undefined,
  body: {
    vrn?: unknown;
    from?: unknown;
    to?: unknown;
    status?: unknown;
    fraudClient?: HmrcClientFraudPayload;
  } = {},
  serverRequest?: VatCallOpts["serverRequest"]
): Promise<HmrcMtdResult> {
  if (!isHmrcMtdEnabled()) return disabledResult();

  try {
    const { accessToken, vrn, fraudHeaders } = await authorizeVatCall({
      authorization,
      vrn: body.vrn,
      fraudClient: body.fraudClient,
      serverRequest,
    });
    const base = resolveHmrcBaseUrl();
    const url = new URL(`${base}/organisations/vat/${encodeURIComponent(vrn)}/obligations`);
    if (typeof body.from === "string" && body.from) url.searchParams.set("from", body.from);
    if (typeof body.to === "string" && body.to) url.searchParams.set("to", body.to);
    if (typeof body.status === "string" && body.status) url.searchParams.set("status", body.status);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.hmrc.1.0+json",
        ...fraudHeaders,
      },
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        status: res.status === 401 ? 401 : 502,
        json: { error: (json.message as string) || (json.error as string) || "HMRC obligations request failed", hmrc: json },
      };
    }
    return { status: 200, json };
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return { status, json: { error: (error as Error).message } };
  }
}

/** Sandbox POST VAT return for a VRN. */
export async function submitVatReturn(
  authorization: string | undefined,
  body: {
    vrn?: unknown;
    periodKey?: unknown;
    vatReturn?: Record<string, unknown>;
    fraudClient?: HmrcClientFraudPayload;
  } = {},
  serverRequest?: VatCallOpts["serverRequest"]
): Promise<HmrcMtdResult> {
  if (!isHmrcMtdEnabled()) return disabledResult();

  try {
    const { accessToken, vrn, fraudHeaders } = await authorizeVatCall({
      authorization,
      vrn: body.vrn,
      fraudClient: body.fraudClient,
      serverRequest,
    });
    const periodKey = typeof body.periodKey === "string" ? body.periodKey.trim() : "";
    if (!periodKey) {
      return { status: 400, json: { error: "periodKey is required" } };
    }
    const vatReturn = body.vatReturn && typeof body.vatReturn === "object" ? body.vatReturn : null;
    if (!vatReturn) {
      return { status: 400, json: { error: "vatReturn body is required" } };
    }

    const base = resolveHmrcBaseUrl();
    const res = await fetch(
      `${base}/organisations/vat/${encodeURIComponent(vrn)}/returns`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.hmrc.1.0+json",
          "Content-Type": "application/json",
          ...fraudHeaders,
        },
        body: JSON.stringify({ ...vatReturn, periodKey }),
      }
    );
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        status: res.status === 401 ? 401 : res.status === 400 ? 400 : 502,
        json: { error: (json.message as string) || (json.error as string) || "HMRC VAT return submit failed", hmrc: json },
      };
    }
    return { status: 200, json };
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return { status, json: { error: (error as Error).message } };
  }
}

/** Callback redirect helper for browser OAuth return. */
export function hmrcCallbackRedirect(
  origin: string,
  ok: boolean,
  reason?: string,
  returnPath = "/admin-uk"
): string {
  const path = sanitizeHmrcReturnPath(returnPath) || "/admin-uk";
  const url = new URL(path, origin.endsWith("/") ? origin : `${origin}/`);
  url.searchParams.set("hmrc", ok ? "connected" : "error");
  if (!ok && reason) url.searchParams.set("hmrc_error", reason.slice(0, 80));
  return url.toString();
}
