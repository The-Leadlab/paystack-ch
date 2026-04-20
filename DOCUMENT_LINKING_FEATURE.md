# Document Linking & Duplicate Prevention Feature

## Date: April 16, 2026

## Summary
Implemented two major features to improve data integrity and user experience:
1. **Duplicate Document Detection** - Prevents processing the same document twice
2. **Document Linking** - Links income/expense entries to their source documents with click-to-view functionality

## Features Implemented

### 1. Duplicate Document Detection

**How it works:**
- When a document is uploaded, a SHA-256 hash is generated from the file content
- Before processing, the system checks if a document with the same hash already exists
- If duplicate is found, user is alerted and processing is skipped
- Prevents duplicate income/expense entries from the same document

**User Experience:**
```
⚠️ This document has already been processed: "invoice_march.pdf"

Skipping to avoid duplicate entries.
```

### 2. Document Linking

**Database Changes:**
- Added `document_id` field to `Income` type
- Added `document_id` field to `Expense` type
- Updated Firestore schema to store `documentId` reference

**Visual Indicators:**
- Items linked to documents show a 📄 (FileText) icon
- Linked items have hover effect indicating they're clickable
- Non-linked items (manually added) don't have the icon

**Click-to-View:**
- Click any income/expense item that has a document link
- Automatically switches to Documents tab
- Opens the source document analysis view
- Shows full document details, line items, and AI analysis

**Navigation Flow:**
```
Dashboard → Click Income/Expense Item → Documents Tab → Document Analysis View
```

## Technical Implementation

### Type Updates (types.ts)
```typescript
export interface Income {
  // ... existing fields
  document_id?: string; // Link to source document
}

export interface Expense {
  // ... existing fields
  document_id?: string; // Link to source document
}
```

### Context Updates (FinanceContext.tsx)
- Updated `addIncome()` to accept optional `documentId` parameter
- Updated `addExpense()` to accept optional `documentId` parameter
- Updated `updateIncome()` to support `document_id` field
- Updated `updateExpense()` to support `document_id` field
- Updated Firestore read/write operations to handle `documentId`

### Component Updates (RestaurantDashboard.tsx)

**handleDocumentData():**
1. Checks for duplicate by fileHash before processing
2. Saves document first to get document ID
3. Passes document ID when creating income/expenses
4. Links all entries to their source document

**IncomeExpenseSection:**
- Added `onItemClick` prop for click handling
- Made items clickable when they have `document_id`
- Added FileText icon indicator for linked items
- Added hover effect for clickable items

**DocumentsTab:**
- Accepts `selectedDocument` prop for pre-selection
- Accepts `onClearSelection` callback
- Automatically shows document when navigated from Dashboard

## User Benefits

### 1. Data Integrity
✅ No duplicate entries from re-uploading same document
✅ Clear warning when duplicate is detected
✅ Maintains clean financial records

### 2. Traceability
✅ Every entry linked to its source document
✅ Quick access to original document for verification
✅ Audit trail for all financial data

### 3. Workflow Efficiency
✅ One click to view source document
✅ No manual searching through documents
✅ Faster verification and reconciliation

## Example Scenarios

### Scenario 1: Duplicate Prevention
```
1. User uploads "supplier_invoice_march.pdf"
2. System processes and creates expense entry
3. User accidentally uploads same file again
4. System detects duplicate hash
5. Alert shown: "This document has already been processed"
6. No duplicate expense created ✅
```

### Scenario 2: Document Linking
```
1. User uploads supplier invoice
2. System creates expense entry with document_id
3. User sees expense in Dashboard with 📄 icon
4. User clicks on expense item
5. Automatically navigates to Documents tab
6. Shows full document analysis view
7. User can verify all details ✅
```

### Scenario 3: Manual Entry
```
1. User manually adds income entry
2. No document_id is set
3. Item shows without 📄 icon
4. Item is not clickable
5. Clearly indicates manual entry ✅
```

## Database Schema

### Firestore Collections

**income collection:**
```javascript
{
  restaurantId: string,
  sessionId: string,
  date: string,
  type: 'SALES' | 'RESERVATION',
  amount: number,
  description: string,
  documentId: string | null,  // NEW FIELD
  createdAt: timestamp
}
```

**expenses collection:**
```javascript
{
  restaurantId: string,
  sessionId: string,
  date: string,
  category: 'BILLS' | 'SUPPLIERS' | 'PAYROLL' | 'OTHER',
  amount: number,
  description: string,
  employeeId: string | null,
  documentId: string | null,  // NEW FIELD
  createdAt: timestamp
}
```

**documents collection:**
```javascript
{
  fileName: string,
  status: string,
  data: FinancialData,
  fileHash: string,  // Used for duplicate detection
  fileDataUrl: string,
  restaurantId: string,
  session_id: string,
  created_at: timestamp
}
```

## Testing Checklist

### Duplicate Detection
- [ ] Upload same document twice - should show warning
- [ ] Upload different documents - should process both
- [ ] Upload modified version of same document - should process (different hash)

### Document Linking
- [ ] Upload invoice - expense should have 📄 icon
- [ ] Upload receipt - income should have 📄 icon
- [ ] Click linked expense - should navigate to document
- [ ] Click linked income - should navigate to document
- [ ] Manually add entry - should NOT have 📄 icon
- [ ] Manually added entry - should NOT be clickable

### Navigation
- [ ] Click item from Dashboard - switches to Documents tab
- [ ] Document analysis view opens automatically
- [ ] Back button returns to Documents list
- [ ] Can navigate to other tabs normally

## Deployment

**Build Status:** ✅ Successful
**Deploy Status:** ✅ Successful
**Production URL:** https://cafe-la-place.web.app

## Future Enhancements

1. **Bulk Document Upload** - Process multiple documents at once
2. **Document Versioning** - Track document updates over time
3. **Smart Duplicate Detection** - Detect similar documents with different hashes
4. **Document Tags** - Add custom tags to documents for better organization
5. **Document Search** - Search documents by content, date, or amount
6. **Export with Documents** - Include document links in CSV/PDF exports

## Notes

- Existing entries in database won't have `document_id` (will be null/undefined)
- Only new entries from document uploads will have document links
- Manual entries will never have document links
- Document hash is SHA-256 of file content
- Hash is stored in Firestore for efficient duplicate checking
