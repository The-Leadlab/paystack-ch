import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export type StoragePrefs = {
  driveMirror: boolean;
  localDownload: boolean;
  deleteStorageAfterDrive: boolean;
};

export const DEFAULT_STORAGE_PREFS: StoragePrefs = {
  driveMirror: true,
  /** Off by default — the file is already on the user's machine from the upload picker. */
  localDownload: false,
  deleteStorageAfterDrive: false,
};

function normalizeStoragePrefs(raw: unknown): StoragePrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_STORAGE_PREFS };
  const rec = raw as Record<string, unknown>;
  return {
    driveMirror: rec.driveMirror !== false,
    // Opt-in only (legacy docs often had true / missing → treat missing as off).
    localDownload: rec.localDownload === true,
    deleteStorageAfterDrive: rec.deleteStorageAfterDrive === true,
  };
}

export async function loadStoragePrefs(uid: string): Promise<StoragePrefs> {
  if (!db || !uid) return { ...DEFAULT_STORAGE_PREFS };
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return { ...DEFAULT_STORAGE_PREFS };
    return normalizeStoragePrefs(snap.data()?.storagePrefs);
  } catch {
    return { ...DEFAULT_STORAGE_PREFS };
  }
}

export async function saveStoragePrefs(uid: string, prefs: StoragePrefs): Promise<void> {
  if (!db || !uid) return;
  await setDoc(doc(db, 'users', uid), { storagePrefs: prefs }, { merge: true });
}
