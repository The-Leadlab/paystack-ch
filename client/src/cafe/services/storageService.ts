import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject, getBytes } from 'firebase/storage';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 500): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        await wait(baseDelayMs * Math.pow(2, i));
      }
    }
  }
  throw lastError;
}

async function fetchAsFile(url: string, fileName: string): Promise<File> {
  const response = await withRetry(() => fetch(url, { cache: 'no-store' }), 3, 600);
  if (!response.ok) {
    throw new Error(`Could not fetch stored file (${response.status})`);
  }
  const blob = await response.blob();
  return new File([blob], fileName || 'document.bin', { type: blob.type || 'application/octet-stream' });
}

/**
 * Upload a file to Firebase Storage
 * @param file - The file to upload
 * @param userId - The user ID (for folder organization)
 * @param fileName - The file name
 * @returns The download URL of the uploaded file
 */
export async function uploadDocument(
  file: File,
  userId: string,
  fileName: string
): Promise<string> {
  if (!storage) {
    throw new Error('Firebase Storage not initialized');
  }

  // Create a reference to the file location
  // Path: documents/{userId}/{timestamp}_{fileName}
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `documents/${userId}/${timestamp}_${sanitizedFileName}`;
  const storageRef = ref(storage, filePath);

  console.log('📤 Uploading file to Firebase Storage:', filePath);

  try {
    // Upload the file
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        originalName: fileName,
        uploadedAt: new Date().toISOString(),
      },
    });

    console.log('✅ File uploaded successfully:', snapshot.metadata.fullPath);

    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('🔗 Download URL:', downloadURL);

    return downloadURL;
  } catch (error) {
    console.error('❌ Error uploading file:', error);
    throw error;
  }
}

/**
 * Delete a file from Firebase Storage
 * @param fileUrl - The download URL of the file to delete
 */
export async function deleteDocument(fileUrl: string): Promise<void> {
  if (!storage) {
    throw new Error('Firebase Storage not initialized');
  }

  try {
    if (!fileUrl || typeof fileUrl !== 'string') {
      throw new Error('Invalid file URL');
    }

    const normalized = fileUrl.trim();
    let storageRef;

    // Accept Firebase download URLs, gs:// URLs, and raw storage paths.
    if (
      normalized.startsWith('https://') ||
      normalized.startsWith('http://') ||
      normalized.startsWith('gs://')
    ) {
      storageRef = ref(storage, normalized);
    } else {
      storageRef = ref(storage, normalized.replace(/^\/+/, ''));
    }

    console.log('🗑️ Deleting file from Firebase Storage:', storageRef.fullPath);
    await deleteObject(storageRef);
    console.log('✅ File deleted successfully');
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err?.code === 'storage/object-not-found') {
      // File already missing in storage; treat as successful cleanup so Firestore delete can proceed.
      console.warn('⚠️ Storage object already missing, skipping delete:', err.message || fileUrl);
      return;
    }
    console.error('❌ Error deleting file:', error);
    throw error;
  }
}

/**
 * Download a stored document and reconstruct it as a File for re-processing.
 * Uses Firebase Storage SDK (authenticated) first, then falls back to fetch.
 */
export async function downloadDocumentFile(fileUrl: string, fileName: string): Promise<File> {
  if (!fileUrl || typeof fileUrl !== 'string') {
    throw new Error('Invalid file URL');
  }

  const normalized = fileUrl.trim();
  const safeName = fileName || 'document.bin';

  if (storage) {
    const storageRef =
      normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('gs://')
        ? ref(storage, normalized)
        : ref(storage, normalized.replace(/^\/+/, ''));

    try {
      // Attempt authenticated SDK download first.
      const bytes = await withRetry(() => getBytes(storageRef), 3, 700);
      const contentType = storageRef.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';
      return new File([bytes], safeName, { type: contentType });
    } catch (sdkError) {
      console.warn('⚠️ SDK download failed, trying fresh download URL:', sdkError);
      try {
        // Generate a fresh URL in case stored URL token is stale.
        const freshUrl = await withRetry(() => getDownloadURL(storageRef), 2, 400);
        return await fetchAsFile(freshUrl, safeName);
      } catch (freshUrlError) {
        console.warn('⚠️ Fresh download URL failed, falling back to stored URL:', freshUrlError);
      }
    }
  }

  return fetchAsFile(normalized, safeName);
}

/**
 * Get file size in a human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
