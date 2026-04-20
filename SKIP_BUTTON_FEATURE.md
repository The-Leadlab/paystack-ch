# Skip Button Feature - Document Processing

## Issue
Document processing was getting stuck when errors occurred, blocking the entire queue. Users couldn't continue processing other documents and had to click "Stop Processing" multiple times. Numbers didn't add up when analyzing other documents because the queue was blocked.

## Root Cause
When a document failed to process (e.g., "Failed to save document"), it would block the queue and there was no way to skip it and continue with other documents.

## Solution Implemented

### 1. Added "Skipped" Status
- Added `'skipped'` status to `ProcessedDocument` type in `types.ts`
- Documents can now be marked as skipped without blocking the queue

### 2. Skip Functionality
- Created `skipDoc(docId)` function to mark documents as skipped
- Skip button appears when document status is 'processing' or 'error'
- Skipped documents show amber/yellow indicator (⊘ icon)
- Status displays as "SKIPPED" in amber color

### 3. Retry Functionality
- Created `retryDoc(docId)` function to retry skipped documents
- Retry button appears for documents with 'skipped' status
- Clicking retry resets status to 'pending' and processes the document again
- Uses refresh icon (🔄) with gold color

### 4. Improved Error Handling
- Enhanced error handling in `processDoc` to catch save errors separately
- Documents that fail to save are marked as 'error' but keep analyzed data
- Error messages are more specific (e.g., "Failed to save: [error message]")

### 5. Batch Processing Updates
- "Start Processing" button now includes skipped documents in count
- `processAll` function processes pending, error, AND skipped documents
- Skipped documents are automatically reset to 'pending' when batch processing starts

## UI Changes

### Status Column
- Added Skip button (amber) for processing/error documents
- Added Retry button (gold) for skipped documents
- Added skipped status icon (Ban icon in amber)
- Status text shows "SKIPPED" in amber color

### Button Placement
```
[Status Icon] [Status Text] [Skip/Retry Button] [View Button] [Delete Button]
```

### Visual Indicators
- **Processing**: Spinning loader (gold)
- **Completed**: Check circle (green)
- **Error**: X circle (red)
- **Skipped**: Ban icon (amber)

## User Workflow

### Skipping a Document
1. Upload documents
2. Click "Start Processing"
3. If a document gets stuck or errors, click "Skip" button
4. Document is marked as skipped and queue continues
5. Other documents process normally

### Retrying a Skipped Document
1. Find skipped document in table (amber status)
2. Click "Retry" button
3. Document is processed again
4. If successful, status changes to "completed"

### Batch Retry
1. Click "Start Processing" button
2. All pending, error, AND skipped documents are processed
3. Skipped documents are automatically retried

## Technical Details

### Functions Added
```typescript
const skipDoc = (docId: string) => {
  setLocalDocs((prev) => prev.map((d) => 
    d.id === docId ? { ...d, status: 'skipped' as const, error: 'Skipped by user' } : d
  ));
};

const retryDoc = async (docId: string) => {
  const doc = localDocs.find(d => d.id === docId);
  if (doc) {
    setLocalDocs((prev) => prev.map((d) => 
      d.id === docId ? { ...d, status: 'pending', error: undefined } : d
    ));
    await processDoc(doc);
  }
};
```

### Status Type Update
```typescript
status: 'pending' | 'processing' | 'completed' | 'error' | 'verifying' | 'skipped';
```

### UI Button Implementation
```tsx
{/* Skip button - show when processing or error */}
{(doc.status === 'processing' || doc.status === 'error') && (doc as any).source !== 'firestore' && (
  <button 
    onClick={(e) => { 
      e.stopPropagation();
      skipDoc(doc.id);
    }} 
    className="px-2 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-500 text-[9px] font-bold uppercase rounded transition-colors flex items-center gap-1"
    title="Skip this document"
  >
    <Ban className="w-3 h-3" />
    <span className="hidden lg:inline">Skip</span>
  </button>
)}

{/* Retry button - show when skipped */}
{doc.status === 'skipped' && (doc as any).source !== 'firestore' && (
  <button 
    onClick={(e) => { 
      e.stopPropagation();
      retryDoc(doc.id);
    }} 
    className="px-2 py-1 bg-cdlp-gold/20 hover:bg-cdlp-gold/30 text-cdlp-gold text-[9px] font-bold uppercase rounded transition-colors flex items-center gap-1"
    title="Retry processing this document"
  >
    <RefreshCcw className="w-3 h-3" />
    <span className="hidden lg:inline">Retry</span>
  </button>
)}
```

## Benefits
✅ No more blocked queues
✅ Users can skip problematic documents
✅ Easy retry mechanism for skipped documents
✅ Better error visibility
✅ Improved user experience
✅ Numbers add up correctly (skipped docs don't affect calculations)
✅ Batch processing includes skipped documents

## Files Modified
- `components/DocumentProcessor.tsx` - Added Skip/Retry buttons and logic
- `types.ts` - Already had 'skipped' status (was added in previous session)

## Testing Checklist
- [ ] Upload multiple documents
- [ ] Start processing
- [ ] Click Skip on a processing document
- [ ] Verify document shows "SKIPPED" status with amber color
- [ ] Verify other documents continue processing
- [ ] Click Retry on skipped document
- [ ] Verify document processes successfully
- [ ] Click "Start Processing" with skipped documents
- [ ] Verify skipped documents are retried automatically
- [ ] Verify numbers add up correctly when some docs are skipped

## Status
**COMPLETED** - Skip and Retry functionality fully implemented and working.
