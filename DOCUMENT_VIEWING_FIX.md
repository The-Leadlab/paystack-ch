# Document Viewing Fix

## Issue
Documents uploaded to Firebase Storage were not visible in the document preview. The preview showed "Document file not available" even though files were successfully uploaded.

## Root Cause
The document preview code was only checking for:
- `fileDataUrl` (deprecated base64 format)
- `fileRaw` (temporary File object)

But NOT checking for:
- `fileUrl` (Firebase Storage URL - the new format)

## Solution

### 1. Updated Document Preview (RestaurantDashboard.tsx)

**Before**:
```typescript
{(selectedDocument.fileDataUrl || selectedDocument.fileRaw) ? (
  <iframe src={selectedDocument.fileDataUrl || ...} />
) : (
  <div>Document file not available</div>
)}
```

**After**:
```typescript
{(selectedDocument.fileUrl || selectedDocument.fileDataUrl || selectedDocument.fileRaw) ? (
  <iframe src={selectedDocument.fileUrl || selectedDocument.fileDataUrl || ...} />
) : (
  <div>Document file not available</div>
)}
```

### 2. Updated Open in New Tab (lib/openDocumentInNewTab.ts)

**Before**:
```typescript
export function openDocumentInNewTab(doc: {
  fileDataUrl?: string;
  fileRaw?: File;
}): void {
  const url = doc.fileDataUrl || (doc.fileRaw ? URL.createObjectURL(doc.fileRaw) : null);
  // ...
}
```

**After**:
```typescript
export function openDocumentInNewTab(doc: {
  fileUrl?: string;        // NEW: Firebase Storage URL
  fileDataUrl?: string;    // Deprecated: base64
  fileRaw?: File;          // Temporary: blob
}): void {
  // Priority: Firebase Storage URL > fileDataUrl > fileRaw blob
  const url = doc.fileUrl || doc.fileDataUrl || (doc.fileRaw ? URL.createObjectURL(doc.fileRaw) : null);
  
  // Firebase Storage URLs can be opened directly
  if (url.startsWith('https://')) {
    window.open(url, '_blank');
    return;
  }
  // ... handle other formats
}
```

## File URL Priority

The system now checks for files in this order:

1. **`fileUrl`** (Firebase Storage) - NEW
   - Format: `https://firebasestorage.googleapis.com/...`
   - Permanent storage
   - Works after page refresh
   - ✅ Preferred method

2. **`fileDataUrl`** (Base64) - DEPRECATED
   - Format: `data:application/pdf;base64,...`
   - Stored in Firestore
   - ❌ Exceeds 11 MB limit
   - Only for old documents

3. **`fileRaw`** (Blob) - TEMPORARY
   - Format: `blob:http://localhost:...`
   - In-memory only
   - ❌ Lost on page refresh
   - Only during processing

## Document Display Flow

### New Documents (with Firebase Storage)
```
1. Upload document
2. Process with Gemini AI
3. Upload to Firebase Storage → Get fileUrl
4. Save to Firestore with fileUrl
5. Display from fileUrl ✅
6. Refresh page → Still works ✅
7. Open in new tab → Still works ✅
```

### Old Documents (without Firebase Storage)
```
1. Document has fileDataUrl (base64)
2. Display from fileDataUrl ✅
3. Refresh page → Still works ✅
4. Open in new tab → Still works ✅
```

### Processing Documents (temporary)
```
1. Upload document
2. Processing... (fileRaw in memory)
3. Display from blob URL ✅
4. Refresh page → Lost ❌
5. After processing → Saved to Storage ✅
```

## Testing

### Test Case 1: New Document Upload
1. Upload a PDF document
2. Click "Start Processing"
3. Wait for completion
4. Click document to expand
5. ✅ Preview should show the document
6. Click "Open Raw Trace"
7. ✅ Document opens in new tab
8. Refresh page (Ctrl+R)
9. ✅ Document still viewable

### Test Case 2: Old Documents
1. Find old document (uploaded before Firebase Storage)
2. Click to expand
3. ✅ Preview should show (from fileDataUrl if available)
4. ❌ If no fileDataUrl, shows "not available"

### Test Case 3: During Processing
1. Upload document
2. Click "Start Processing"
3. While processing, click document
4. ✅ Preview should show (from fileRaw blob)
5. After processing completes
6. ✅ Preview updates to Firebase Storage URL

## Files Modified

1. **components/RestaurantDashboard.tsx**
   - Added `fileUrl` check in document preview
   - Added `fileUrl` check in "Open Raw Trace" button
   - Priority: fileUrl > fileDataUrl > fileRaw

2. **lib/openDocumentInNewTab.ts**
   - Added `fileUrl` parameter to function signature
   - Added Firebase Storage URL handling
   - Priority: fileUrl > fileDataUrl > fileRaw

## Backward Compatibility

The fix maintains backward compatibility:
- ✅ New documents use Firebase Storage (fileUrl)
- ✅ Old documents with base64 (fileDataUrl) still work
- ✅ Processing documents with blob (fileRaw) still work
- ✅ Graceful fallback if no file available

## Status
✅ **FIXED** - Documents now viewable from Firebase Storage

## Deployed
- Build: ✅ Successful
- Deploy: ✅ Successful
- URL: https://cafe-la-place.web.app

## Next Steps
1. Upload new documents
2. Verify they appear in preview
3. Click "Open Raw Trace" to test new tab
4. Refresh page and verify still viewable
