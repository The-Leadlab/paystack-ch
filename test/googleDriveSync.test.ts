import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDriveSaveDocument, runDriveSyncFromDrive } from "../lib/googleDriveSync.js";
import { saveDocumentToDrive } from "../lib/googleServices.js";
import { verifyFirebaseAuthorizationHeader } from "../lib/verifyFirebaseIdToken.js";

vi.mock("../lib/verifyFirebaseIdToken.js", () => ({
  verifyFirebaseAuthorizationHeader: vi.fn(),
}));

vi.mock("../lib/googleServices.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/googleServices.js")>();
  return {
    ...actual,
    saveDocumentToDrive: vi.fn(),
  };
});

const firestoreSetMock = vi.fn().mockResolvedValue(undefined);
const firestoreGetMock = vi.fn().mockResolvedValue({ data: () => undefined });
const firestoreDocMock = vi.fn(() => ({ set: firestoreSetMock, get: firestoreGetMock }));
const firestoreCollectionMock = vi.fn(() => ({ doc: firestoreDocMock }));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => ({ collection: firestoreCollectionMock })),
  FieldValue: { serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"), delete: vi.fn(() => "FIELD_DELETE_SENTINEL") },
}));

const fileSaveMock = vi.fn().mockResolvedValue(undefined);
const getSignedUrlMock = vi.fn().mockResolvedValue(["https://storage.googleapis.com/signed-url"]);
const bucketFileMock = vi.fn(() => ({ save: fileSaveMock, getSignedUrl: getSignedUrlMock }));
const bucketMock = vi.fn(() => ({ file: bucketFileMock }));

vi.mock("firebase-admin/storage", () => ({
  getStorage: vi.fn(() => ({ bucket: bucketMock })),
}));

vi.mock("../lib/firebaseAdmin.js", () => ({
  ensureFirebaseAdmin: vi.fn(),
  hasFirebaseAdminCredentials: vi.fn(() => true),
}));

vi.mock("../lib/firebaseStorageAdmin.js", () => ({
  assertOwnedStoragePath: vi.fn(),
  isAllowedFirebaseStorageUrl: vi.fn(() => true),
  readStorageFileForUser: vi.fn(async () => ({
    bytes: Buffer.from("pdf-bytes"),
    mimeType: "application/pdf",
  })),
  resolveFirebaseStorageBucket: vi.fn(() => "test-project.firebasestorage.app"),
}));

describe("runDriveSaveDocument", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    vi.mocked(verifyFirebaseAuthorizationHeader).mockResolvedValue("user-1");
    vi.mocked(saveDocumentToDrive).mockResolvedValue({ status: 200, json: { uploaded: true, fileId: "drive-1" } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches storage bytes and forwards to saveDocumentToDrive", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      headers: { get: () => "application/pdf" },
      arrayBuffer: async () => new TextEncoder().encode("pdf-bytes").buffer,
    });

    const out = await runDriveSaveDocument("Bearer token", {
      storagePath: "documents/user-1/123_report.pdf",
      fileUrl: "https://firebasestorage.googleapis.com/v0/b/x/o/documents%2Fuser-1%2F123_report.pdf?alt=media",
      filename: "report.pdf",
      mimeType: "application/pdf",
    });

    expect(out.status).toBe(200);
    expect(saveDocumentToDrive).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        filename: "report.pdf",
        sourceId: "documents/user-1/123_report.pdf",
      })
    );
  });
});

describe("runDriveSyncFromDrive", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    vi.mocked(verifyFirebaseAuthorizationHeader).mockResolvedValue("user-1");
    vi.stubEnv("GOOGLE_DRIVE_CLIENT_ID", "cid");
    vi.stubEnv("GOOGLE_DRIVE_CLIENT_SECRET", "secret");
    vi.stubEnv("FIREBASE_STORAGE_BUCKET", "test-project.firebasestorage.app");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("imports a new Drive file into Firebase Storage", async () => {
    firestoreGetMock.mockResolvedValue({
      data: () => ({
        googleDrive: {
          refreshToken: "refresh-1",
          folderId: "folder-abc",
          uploadedDocuments: {},
          importedDriveFiles: {},
        },
      }),
    });

    fetchMock.mockImplementation((url: string) => {
      if (url === "https://oauth2.googleapis.com/token") {
        return Promise.resolve({ ok: true, json: async () => ({ access_token: "access-1" }) });
      }
      if (url.includes("drive/v3/files?")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            files: [{ id: "drive-file-1", name: "invoice.pdf", mimeType: "application/pdf", size: "1000" }],
          }),
        });
      }
      if (url.includes("drive-file-1?alt=media")) {
        return Promise.resolve({
          ok: true,
          headers: { get: () => "application/pdf" },
          arrayBuffer: async () => new TextEncoder().encode("invoice-bytes").buffer,
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const out = await runDriveSyncFromDrive("Bearer token");
    expect(out.status).toBe(200);
    expect(out.json.imported).toHaveLength(1);
    expect(fileSaveMock).toHaveBeenCalled();
    expect(firestoreSetMock).toHaveBeenCalled();
  });
});
