import { createHmac, timingSafeEqual } from "node:crypto";
import { nanoid } from "nanoid";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { ensureFirebaseAdmin, hasFirebaseAdminCredentials } from "./firebaseAdmin.js";
import { verifyFirebaseAuthorizationHeader } from "./verifyFirebaseIdToken.js";
import { assertOwnedStoragePath, fetchStorageBytes, isAllowedFirebaseStorageUrl } from "./firebaseStorageFetch.js";
import { MAX_STORAGE_UPLOAD_BYTES } from "../shared/geminiLimits.js";

const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_OAUTH_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
const GOOGLE_DRIVE_SCOPE =
  "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly";
const GOOGLE_DRIVE_FOLDER_NAME = "Paystack Documents";
const GOOGLE_DRIVE_UNCATEGORIZED_FOLDER_NAME = "Uncategorised";

export type GoogleServicesResult =
  | { status: number; redirectUrl: string }
  | { status: number; json: Record<string, unknown> };

/** Monday-start week containing `date`, formatted "dd-dd/mm/yyyy" (start day-end day/month/year).
 * When the week crosses a month or year boundary, the month/year are anchored to the Monday
 * (the week's start), not the Sunday — e.g. the week of Mon 29 Jun–Sun 5 Jul 2026 is "29-05/06/2026". */
export function computeWeekFolderName(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = d.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const pad = (n: number) => String(n).padStart(2, "0");
  const startDay = pad(monday.getUTCDate());
  const endDay = pad(sunday.getUTCDate());
  const month = pad(monday.getUTCMonth() + 1);
  const year = monday.getUTCFullYear();

  return `${startDay}-${endDay}/${month}/${year}`;
}

/** Parses a document date extracted by AI, which may come back as ISO ("2026-01-31") or
 * Swiss/European ("31.01.2026") format depending on the source document. Returns an Invalid
 * Date (not a thrown error) when `value` doesn't match either format, so callers can fall back
 * to the uncategorized folder with a simple `Number.isNaN(date.getTime())` check. */
export function parseDocumentDate(value: string): Date {
  const swissMatch = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (swissMatch) {
    const [, day, month, year] = swissMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }
  return new Date(value);
}

function parseTruthyEnv(value: string | undefined): boolean {
  return value?.toLowerCase() === "true" || value === "1";
}

function resolveGoogleDriveEnv(baseVarName: string): string {
  const useTestMode = parseTruthyEnv(process.env.GOOGLE_DRIVE_USE_TEST_MODE);
  const varName = useTestMode ? `GOOGLE_DRIVE_TEST_${baseVarName}` : `GOOGLE_DRIVE_${baseVarName}`;
  const value = process.env[varName]?.trim();
  if (!value) {
    throw Object.assign(new Error(`Server missing ${varName}`), { status: 503 });
  }
  return value;
}

function resolveGoogleDriveClientId(): string {
  return resolveGoogleDriveEnv("CLIENT_ID");
}

function resolveGoogleDriveClientSecret(): string {
  return resolveGoogleDriveEnv("CLIENT_SECRET");
}

function resolveGoogleDriveRedirectUri(): string {
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI?.trim();
  if (!redirectUri) {
    throw Object.assign(new Error("Server missing GOOGLE_DRIVE_REDIRECT_URI"), { status: 503 });
  }
  return redirectUri;
}

const STATE_TTL_MS = 10 * 60 * 1000;

export type OAuthState = { uid: string; nonce: string; expiresAt: number };

function stateSigningSecret(): string {
  const secret = process.env.GOOGLE_DRIVE_STATE_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw Object.assign(
      new Error("GOOGLE_DRIVE_STATE_SECRET is not configured (min 16 characters)."),
      { status: 503 }
    );
  }
  return secret;
}

/** HMAC-signed so a forged or tampered state (e.g. claiming another user's uid) is rejected. */
export function createOAuthState(uid: string): string {
  const payload = JSON.stringify({
    uid,
    nonce: nanoid(),
    expiresAt: Date.now() + STATE_TTL_MS,
  } satisfies OAuthState);
  const sig = createHmac("sha256", stateSigningSecret()).update(payload).digest("base64url");
  return Buffer.from(JSON.stringify({ payload, sig }), "utf8").toString("base64url");
}

export function decodeOAuthState(state: string): OAuthState {
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

  const inner = JSON.parse(parsed.payload) as OAuthState;
  if (!inner.uid || !inner.nonce || typeof inner.expiresAt !== "number") throw invalid();
  if (inner.expiresAt < Date.now()) throw invalid();

  return inner;
}

export async function startGoogleDriveOAuth(
  authorization: string | undefined
): Promise<GoogleServicesResult> {
  let uid: string;
  try {
    uid = await verifyFirebaseAuthorizationHeader(authorization);
  } catch (error) {
    const status = (error as { status?: number }).status || 401;
    return { status, json: { error: (error as Error).message } };
  }

  try {
    const authUrl = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);
    authUrl.searchParams.set("client_id", resolveGoogleDriveClientId());
    authUrl.searchParams.set("redirect_uri", resolveGoogleDriveRedirectUri());
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", GOOGLE_DRIVE_SCOPE);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", createOAuthState(uid));

    return { status: 302, redirectUrl: authUrl.toString() };
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return { status, json: { error: (error as Error).message } };
  }
}

type GoogleTokenExchange = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

async function exchangeGoogleAuthCode(code: string): Promise<GoogleTokenExchange> {
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: resolveGoogleDriveClientId(),
      client_secret: resolveGoogleDriveClientSecret(),
      redirect_uri: resolveGoogleDriveRedirectUri(),
      grant_type: "authorization_code",
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
    throw Object.assign(
      new Error(data.error_description || data.error || "Failed to exchange Google authorization code"),
      { status: 400 }
    );
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in ?? 3600,
  };
}

async function createDriveFolder(accessToken: string, name: string, parentId?: string): Promise<string> {
  const res = await fetch(GOOGLE_DRIVE_FILES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };

  if (!res.ok || !data.id) {
    throw Object.assign(new Error(data.error?.message || "Failed to create Google Drive folder"), {
      status: driveResponseStatus(res.status),
    });
  }

  return data.id;
}

function driveResponseStatus(httpStatus: number): number {
  if (httpStatus === 401) return 401;
  if (httpStatus === 404) return 404;
  return 502;
}

function isDriveNotFoundError(error: unknown): boolean {
  if ((error as { status?: number }).status === 404) return true;
  const message = String((error as Error)?.message || "").toLowerCase();
  return message.includes("not found") || message.includes("file not found");
}

/** Returns true when the Drive folder still exists and is not in trash. */
async function driveFolderExists(accessToken: string, folderId: string): Promise<boolean> {
  const res = await fetch(
    `${GOOGLE_DRIVE_FILES_URL}/${encodeURIComponent(folderId)}?fields=${encodeURIComponent("id,trashed")}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (res.status === 404) return false;
  if (res.status === 401) {
    throw Object.assign(new Error("Google Drive access token expired"), { status: 401 });
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw Object.assign(new Error(data.error?.message || "Failed to verify Google Drive folder"), {
      status: driveResponseStatus(res.status),
    });
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string; trashed?: boolean };
  return Boolean(data.id) && data.trashed !== true;
}

async function createGoogleDriveFolder(accessToken: string): Promise<string> {
  return createDriveFolder(accessToken, GOOGLE_DRIVE_FOLDER_NAME);
}

async function getExistingGoogleDriveFolderId(uid: string): Promise<string | null> {
  ensureFirebaseAdmin();
  const snap = await getFirestore().collection("users").doc(uid).get();
  const folderId = (snap.data() as { googleDrive?: { folderId?: unknown } } | undefined)?.googleDrive
    ?.folderId;
  return typeof folderId === "string" ? folderId : null;
}

/** Clears week/uncategorised caches and upload dedupe so a new root folder starts clean. */
async function resetDriveFolderCaches(
  uid: string,
  next?: { folderId?: string; clearUploadedDocuments?: boolean }
): Promise<void> {
  ensureFirebaseAdmin();
  const googleDrive: Record<string, unknown> = {
    weekFolders: FieldValue.delete(),
    uncategorizedFolderId: FieldValue.delete(),
  };
  if (next?.folderId) googleDrive.folderId = next.folderId;
  if (next?.clearUploadedDocuments) googleDrive.uploadedDocuments = FieldValue.delete();
  await getFirestore().collection("users").doc(uid).set({ googleDrive }, { merge: true });
}

/**
 * Verifies the cached root folder still exists in Drive. If the user deleted it (or cache is
 * empty), creates a fresh "Paystack Documents" folder and clears stale subfolder IDs.
 */
export async function ensureValidRootFolder(
  uid: string,
  accessToken: string,
  folderId: string | null
): Promise<string> {
  if (folderId && (await driveFolderExists(accessToken, folderId))) {
    return folderId;
  }
  const newFolderId = await createGoogleDriveFolder(accessToken);
  await resetDriveFolderCaches(uid, { folderId: newFolderId, clearUploadedDocuments: true });
  return newFolderId;
}

async function storeGoogleDriveConnection(
  uid: string,
  connection: { refreshToken: string; folderId: string }
): Promise<void> {
  ensureFirebaseAdmin();
  await getFirestore()
    .collection("users")
    .doc(uid)
    .set(
      {
        googleDrive: {
          refreshToken: connection.refreshToken,
          folderId: connection.folderId,
          connectedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
}

export async function completeGoogleDriveOAuth(
  code: string,
  state: string
): Promise<GoogleServicesResult> {
  try {
    const { uid } = decodeOAuthState(state);
    const tokens = await exchangeGoogleAuthCode(code);
    if (!tokens.refresh_token) {
      throw Object.assign(
        new Error("Google did not return a refresh token. Reconnect and grant consent again."),
        { status: 502 }
      );
    }
    if (!hasFirebaseAdminCredentials()) {
      throw Object.assign(new Error("Server missing Firebase Admin credentials"), { status: 503 });
    }
    const existingFolderId = await getExistingGoogleDriveFolderId(uid);
    let folderId: string;
    if (existingFolderId && (await driveFolderExists(tokens.access_token, existingFolderId))) {
      folderId = existingFolderId;
    } else {
      folderId = await createGoogleDriveFolder(tokens.access_token);
      if (existingFolderId) {
        await resetDriveFolderCaches(uid, { folderId, clearUploadedDocuments: true });
      }
    }
    await storeGoogleDriveConnection(uid, { refreshToken: tokens.refresh_token, folderId });
    return { status: 200, json: { connected: true } };
  } catch (error) {
    const status = (error as { status?: number }).status || 400;
    return { status, json: { error: (error as Error).message } };
  }
}

async function getGoogleDriveRefreshToken(uid: string): Promise<string | null> {
  ensureFirebaseAdmin();
  const snap = await getFirestore().collection("users").doc(uid).get();
  const refreshToken = (snap.data() as { googleDrive?: { refreshToken?: unknown } } | undefined)
    ?.googleDrive?.refreshToken;
  return typeof refreshToken === "string" ? refreshToken : null;
}

async function revokeGoogleToken(refreshToken: string): Promise<void> {
  const res = await fetch(GOOGLE_OAUTH_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }).toString(),
  });
  if (!res.ok) {
    throw Object.assign(new Error("Failed to revoke Google Drive access"), { status: 502 });
  }
}

async function deleteGoogleDriveConnection(uid: string): Promise<void> {
  ensureFirebaseAdmin();
  await getFirestore()
    .collection("users")
    .doc(uid)
    .set({ googleDrive: FieldValue.delete() }, { merge: true });
}

export async function disconnectGoogleDrive(
  authorization: string | undefined
): Promise<GoogleServicesResult> {
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
    const refreshToken = await getGoogleDriveRefreshToken(uid);
    if (refreshToken) {
      try {
        await revokeGoogleToken(refreshToken);
      } catch {
        // Best-effort: the local connection is still cleared even if Google's revoke call fails
        // (e.g. the token was already revoked on Google's side, or a transient network error).
      }
    }
    await deleteGoogleDriveConnection(uid);
    return { status: 200, json: { disconnected: true } };
  } catch (error) {
    const status = (error as { status?: number }).status || 400;
    return { status, json: { error: (error as Error).message } };
  }
}

export type GoogleDriveConnection = {
  refreshToken: string;
  folderId: string | null;
  uploadedDocuments: Record<string, unknown>;
  weekFolders: Record<string, string>;
  uncategorizedFolderId: string | null;
};

/** An already-uploaded document's Drive file id, plus whether it was filed into its correct week
 * folder (`categorized: true`) or landed in "Uncategorised" for lack of a date at the time
 * (`categorized: false`) — the latter is eligible to be moved into place on a later call once a
 * date is known, instead of being silently skipped as a duplicate forever. */
type UploadedDocumentEntry = { fileId: string; categorized: boolean };

/** Older records were stored as a bare file-id string (before categorization tracking existed);
 * treated as `categorized: false` so they're still eligible for the self-healing move below. */
function normalizeUploadedDocumentEntry(value: unknown): UploadedDocumentEntry | null {
  if (typeof value === "string") return { fileId: value, categorized: false };
  if (value && typeof value === "object" && typeof (value as { fileId?: unknown }).fileId === "string") {
    return {
      fileId: (value as { fileId: string }).fileId,
      categorized: (value as { categorized?: unknown }).categorized === true,
    };
  }
  return null;
}

/** Firestore map keys can't contain certain characters (e.g. `.`, `/`), which real source ids
 * (Firebase Storage paths, filenames) commonly do — so the key is encoded, not used raw. */
function driveUploadKey(sourceId: string): string {
  return Buffer.from(sourceId).toString("base64url");
}

async function getGoogleDriveConnection(uid: string): Promise<GoogleDriveConnection | null> {
  ensureFirebaseAdmin();
  const snap = await getFirestore().collection("users").doc(uid).get();
  const googleDrive = (
    snap.data() as
      | {
          googleDrive?: {
            refreshToken?: unknown;
            folderId?: unknown;
            uploadedDocuments?: unknown;
            weekFolders?: unknown;
            uncategorizedFolderId?: unknown;
          };
        }
      | undefined
  )?.googleDrive;
  if (typeof googleDrive?.refreshToken !== "string") return null;

  const uploadedDocuments =
    googleDrive.uploadedDocuments && typeof googleDrive.uploadedDocuments === "object"
      ? (googleDrive.uploadedDocuments as Record<string, unknown>)
      : {};
  const weekFoldersRaw =
    googleDrive.weekFolders && typeof googleDrive.weekFolders === "object"
      ? (googleDrive.weekFolders as Record<string, unknown>)
      : {};
  const weekFolders: Record<string, string> = {};
  for (const [key, value] of Object.entries(weekFoldersRaw)) {
    if (typeof value === "string") weekFolders[key] = value;
  }

  return {
    refreshToken: googleDrive.refreshToken,
    folderId: typeof googleDrive.folderId === "string" ? googleDrive.folderId : null,
    uploadedDocuments,
    weekFolders,
    uncategorizedFolderId:
      typeof googleDrive.uncategorizedFolderId === "string" ? googleDrive.uncategorizedFolderId : null,
  };
}

async function recordDriveUpload(
  uid: string,
  sourceId: string,
  fileId: string,
  categorized: boolean
): Promise<void> {
  ensureFirebaseAdmin();
  const entry: UploadedDocumentEntry = { fileId, categorized };
  await getFirestore()
    .collection("users")
    .doc(uid)
    .set({ googleDrive: { uploadedDocuments: { [driveUploadKey(sourceId)]: entry } } }, { merge: true });
}

async function markGoogleDriveNeedsReconnect(uid: string): Promise<void> {
  ensureFirebaseAdmin();
  await getFirestore()
    .collection("users")
    .doc(uid)
    .set({ googleDrive: { needsReconnect: true } }, { merge: true });
}

async function getGoogleDriveAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: resolveGoogleDriveClientId(),
      client_secret: resolveGoogleDriveClientSecret(),
      grant_type: "refresh_token",
    }).toString(),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw Object.assign(
      new Error(data.error_description || data.error || "Failed to refresh Google Drive access token"),
      { status: 401, code: data.error }
    );
  }

  return data.access_token;
}

export type DriveUploadFile = {
  bytes: Buffer;
  filename: string;
  mimeType: string;
  /** Stable identifier for this upload event (e.g. the Firebase Storage path). Used to dedupe
   * so a retried/duplicated request doesn't create a second copy in Drive. */
  sourceId: string;
  /** The document's own date, as extracted by AI processing (ISO or Swiss/European format).
   * When present and parseable, the upload is filed directly into that week's subfolder;
   * otherwise it lands in the "Uncategorised" folder. */
  documentDate?: string;
};

async function uploadFileToDrive(accessToken: string, folderId: string, file: DriveUploadFile): Promise<string> {
  const boundary = `paystack-${nanoid()}`;
  const metadata = JSON.stringify({ name: file.filename, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: ${file.mimeType}\r\n\r\n`,
      "utf8"
    ),
    file.bytes,
    Buffer.from(`\r\n--${boundary}--`, "utf8"),
  ]);

  const res = await fetch(GOOGLE_DRIVE_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };

  if (!res.ok || !data.id) {
    throw Object.assign(new Error(data.error?.message || "Failed to upload document to Google Drive"), {
      status: driveResponseStatus(res.status),
    });
  }

  return data.id;
}

/** Refreshes the access token; if the refresh token itself is dead (`invalid_grant`), marks the
 * connection as needing reconnection instead of leaving it silently and permanently broken. */
async function refreshAccessTokenOrMarkDisconnected(uid: string, refreshToken: string): Promise<string> {
  try {
    return await getGoogleDriveAccessToken(refreshToken);
  } catch (error) {
    if ((error as { code?: string }).code === "invalid_grant") {
      await markGoogleDriveNeedsReconnect(uid);
    }
    throw error;
  }
}

export async function saveDocumentToDrive(
  uid: string,
  file: DriveUploadFile
): Promise<GoogleServicesResult> {
  try {
    if (!hasFirebaseAdminCredentials()) {
      throw Object.assign(new Error("Server missing Firebase Admin credentials"), { status: 503 });
    }
    const connection = await getGoogleDriveConnection(uid);
    if (!connection) {
      return { status: 200, json: { skipped: true } };
    }

    const parsedDate = file.documentDate ? parseDocumentDate(file.documentDate) : null;
    const hasValidDate = parsedDate !== null && !Number.isNaN(parsedDate.getTime());

    const existing = normalizeUploadedDocumentEntry(connection.uploadedDocuments[driveUploadKey(file.sourceId)]);
    if (existing) {
      if (existing.categorized || !hasValidDate) {
        return { status: 200, json: { uploaded: true, fileId: existing.fileId, alreadyUploaded: true } };
      }
      // A previous attempt backed this up before a date was known (processing had failed, or no
      // date was found), landing it in "Uncategorised". Now that a valid date is known, move the
      // existing file into its week folder instead of skipping it as a duplicate forever.
      let accessToken = await refreshAccessTokenOrMarkDisconnected(uid, connection.refreshToken);
      const weekName = computeWeekFolderName(parsedDate as Date);
      const moveOnce = async (token: string, rootFolderId: string) => {
        const uncategorizedFolderId = await getOrCreateUncategorizedFolder(
          uid,
          token,
          rootFolderId,
          connection.uncategorizedFolderId
        );
        const weekFolderId = await getOrCreateWeekFolder(
          uid,
          token,
          rootFolderId,
          weekName,
          connection.weekFolders[driveUploadKey(weekName)]
        );
        if (uncategorizedFolderId !== weekFolderId) {
          await moveDriveFile(token, existing.fileId, uncategorizedFolderId, weekFolderId);
        }
      };
      try {
        const rootFolderId = await ensureValidRootFolder(uid, accessToken, connection.folderId);
        await moveOnce(accessToken, rootFolderId);
      } catch (error) {
        if ((error as { status?: number }).status === 401) {
          accessToken = await refreshAccessTokenOrMarkDisconnected(uid, connection.refreshToken);
          const rootFolderId = await ensureValidRootFolder(uid, accessToken, connection.folderId);
          await moveOnce(accessToken, rootFolderId);
        } else if (isDriveNotFoundError(error)) {
          accessToken = await refreshAccessTokenOrMarkDisconnected(uid, connection.refreshToken);
          const rootFolderId = await ensureValidRootFolder(uid, accessToken, null);
          connection.weekFolders = {};
          connection.uncategorizedFolderId = null;
          await moveOnce(accessToken, rootFolderId);
        } else {
          throw error;
        }
      }
      await recordDriveUpload(uid, file.sourceId, existing.fileId, true);
      return { status: 200, json: { uploaded: true, fileId: existing.fileId, moved: true } };
    }

    let accessToken = await refreshAccessTokenOrMarkDisconnected(uid, connection.refreshToken);
    let rootFolderId = await ensureValidRootFolder(uid, accessToken, connection.folderId);
    const weekName = hasValidDate ? computeWeekFolderName(parsedDate as Date) : null;

    const uploadOnce = async (token: string, rootId: string) => {
      const targetFolderId =
        weekName != null
          ? await getOrCreateWeekFolder(
              uid,
              token,
              rootId,
              weekName,
              connection.weekFolders[driveUploadKey(weekName)]
            )
          : await getOrCreateUncategorizedFolder(uid, token, rootId, connection.uncategorizedFolderId);
      return uploadFileToDrive(token, targetFolderId, file);
    };

    let fileId: string;
    try {
      fileId = await uploadOnce(accessToken, rootFolderId);
    } catch (error) {
      if ((error as { status?: number }).status === 401) {
        // Access token expired/invalid between issuance and use: fetch a fresh one and retry
        // exactly once. A second 401 (or invalid_grant) propagates to the outer catch rather than looping.
        accessToken = await refreshAccessTokenOrMarkDisconnected(uid, connection.refreshToken);
        rootFolderId = await ensureValidRootFolder(uid, accessToken, rootFolderId);
        fileId = await uploadOnce(accessToken, rootFolderId);
      } else if (isDriveNotFoundError(error)) {
        // User deleted the Drive folder (or a week subfolder). Recreate root + caches, retry once.
        accessToken = await refreshAccessTokenOrMarkDisconnected(uid, connection.refreshToken);
        rootFolderId = await ensureValidRootFolder(uid, accessToken, null);
        connection.weekFolders = {};
        connection.uncategorizedFolderId = null;
        fileId = await uploadOnce(accessToken, rootFolderId);
      } else {
        throw error;
      }
    }
    await recordDriveUpload(uid, file.sourceId, fileId, hasValidDate);
    return { status: 200, json: { uploaded: true, fileId } };
  } catch (error) {
    const status = (error as { status?: number }).status || 400;
    return { status, json: { error: (error as Error).message } };
  }
}

async function moveDriveFile(
  accessToken: string,
  fileId: string,
  fromFolderId: string,
  toFolderId: string
): Promise<void> {
  const res = await fetch(
    `${GOOGLE_DRIVE_FILES_URL}/${encodeURIComponent(fileId)}` +
      `?addParents=${encodeURIComponent(toFolderId)}&removeParents=${encodeURIComponent(fromFolderId)}`,
    { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw Object.assign(new Error(data.error?.message || "Failed to move file into week folder"), {
      status: driveResponseStatus(res.status),
    });
  }
}

async function findDriveFolderByName(
  accessToken: string,
  name: string,
  parentId: string
): Promise<string | null> {
  const escapedName = name.replace(/'/g, "\\'");
  const q = `'${parentId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = await fetch(
    `${GOOGLE_DRIVE_FILES_URL}?q=${encodeURIComponent(q)}&fields=${encodeURIComponent("files(id)")}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = (await res.json().catch(() => ({}))) as {
    files?: { id: string }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw Object.assign(new Error(data.error?.message || "Failed to search Google Drive folders"), {
      status: driveResponseStatus(res.status),
    });
  }
  return data.files?.[0]?.id ?? null;
}

async function getWeekFolderId(uid: string, weekName: string): Promise<string | null> {
  ensureFirebaseAdmin();
  const snap = await getFirestore().collection("users").doc(uid).get();
  const weekFolders = (snap.data() as { googleDrive?: { weekFolders?: unknown } } | undefined)?.googleDrive
    ?.weekFolders;
  if (weekFolders && typeof weekFolders === "object") {
    const id = (weekFolders as Record<string, unknown>)[driveUploadKey(weekName)];
    return typeof id === "string" ? id : null;
  }
  return null;
}

async function recordWeekFolder(uid: string, weekName: string, folderId: string): Promise<void> {
  ensureFirebaseAdmin();
  await getFirestore()
    .collection("users")
    .doc(uid)
    .set({ googleDrive: { weekFolders: { [driveUploadKey(weekName)]: folderId } } }, { merge: true });
}

/** Finds, or creates, the subfolder for a given week under the user's root Drive folder.
 * Prefers an in-memory cache from the connection blob (avoids an extra Firestore read), then
 * Drive search, then create. */
async function getOrCreateWeekFolder(
  uid: string,
  accessToken: string,
  rootFolderId: string,
  weekName: string,
  cachedFolderId?: string | null
): Promise<string> {
  const cached = cachedFolderId ?? (await getWeekFolderId(uid, weekName));
  if (cached) return cached;

  const existing = await findDriveFolderByName(accessToken, weekName, rootFolderId);
  const folderId = existing ?? (await createDriveFolder(accessToken, weekName, rootFolderId));
  await recordWeekFolder(uid, weekName, folderId);
  return folderId;
}

async function getUncategorizedFolderId(uid: string): Promise<string | null> {
  ensureFirebaseAdmin();
  const snap = await getFirestore().collection("users").doc(uid).get();
  const folderId = (
    snap.data() as { googleDrive?: { uncategorizedFolderId?: unknown } } | undefined
  )?.googleDrive?.uncategorizedFolderId;
  return typeof folderId === "string" ? folderId : null;
}

async function recordUncategorizedFolderId(uid: string, folderId: string): Promise<void> {
  ensureFirebaseAdmin();
  await getFirestore()
    .collection("users")
    .doc(uid)
    .set({ googleDrive: { uncategorizedFolderId: folderId } }, { merge: true });
}

/** Finds, or creates, the "Uncategorised" folder under the user's root Drive folder — the
 * destination for documents whose date couldn't be determined (processing failed, or no date
 * was extracted). Same cache-then-search-then-create pattern as `getOrCreateWeekFolder`. */
async function getOrCreateUncategorizedFolder(
  uid: string,
  accessToken: string,
  rootFolderId: string,
  cachedFolderId?: string | null
): Promise<string> {
  const cached = cachedFolderId ?? (await getUncategorizedFolderId(uid));
  if (cached) return cached;

  const existing = await findDriveFolderByName(accessToken, GOOGLE_DRIVE_UNCATEGORIZED_FOLDER_NAME, rootFolderId);
  const folderId =
    existing ?? (await createDriveFolder(accessToken, GOOGLE_DRIVE_UNCATEGORIZED_FOLDER_NAME, rootFolderId));
  await recordUncategorizedFolderId(uid, folderId);
  return folderId;
}

export async function getGoogleDriveStatus(
  authorization: string | undefined
): Promise<GoogleServicesResult> {
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
    ensureFirebaseAdmin();
    const snap = await getFirestore().collection("users").doc(uid).get();
    const googleDrive = (
      snap.data() as { googleDrive?: { refreshToken?: unknown; needsReconnect?: unknown } } | undefined
    )?.googleDrive;
    return {
      status: 200,
      json: {
        connected: typeof googleDrive?.refreshToken === "string",
        needsReconnect: googleDrive?.needsReconnect === true,
      },
    };
  } catch (error) {
    const status = (error as { status?: number }).status || 400;
    return { status, json: { error: (error as Error).message } };
  }
}

export type SaveUploadedDocumentRequest = {
  storagePath?: unknown;
  fileUrl?: unknown;
  filename?: unknown;
  mimeType?: unknown;
};

/** Called right after a document lands in Firebase Storage — fetches those same bytes and
 * pushes them into the uploader's connected Drive folder, if they have one. A no-op (not an
 * error) when the user isn't connected; that's handled inside saveDocumentToDrive. */
export async function saveUploadedDocumentToDrive(
  authorization: string | undefined,
  body: SaveUploadedDocumentRequest
): Promise<GoogleServicesResult> {
  let uid: string;
  try {
    uid = await verifyFirebaseAuthorizationHeader(authorization);
  } catch (error) {
    const status = (error as { status?: number }).status || 401;
    return { status, json: { error: (error as Error).message } };
  }

  try {
    const storagePath = typeof body.storagePath === "string" ? body.storagePath.trim() : "";
    const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";
    const filename = typeof body.filename === "string" && body.filename.trim() ? body.filename.trim() : "document";
    if (!storagePath || !fileUrl) {
      return { status: 400, json: { error: "storagePath and fileUrl are required" } };
    }

    assertOwnedStoragePath(uid, storagePath);
    if (!isAllowedFirebaseStorageUrl(fileUrl, uid)) {
      return { status: 403, json: { error: "fileUrl is not allowed for this account" } };
    }

    const { bytes, mimeType: fetchedMime } = await fetchStorageBytes(fileUrl, MAX_STORAGE_UPLOAD_BYTES);
    const mimeType =
      (typeof body.mimeType === "string" && body.mimeType.trim()) || fetchedMime || "application/octet-stream";

    return await saveDocumentToDrive(uid, { bytes, filename, mimeType, sourceId: storagePath });
  } catch (error) {
    const status = (error as { status?: number }).status || 400;
    return { status, json: { error: (error as Error).message } };
  }
}
