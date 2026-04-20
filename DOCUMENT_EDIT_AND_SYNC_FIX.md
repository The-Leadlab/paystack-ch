# Document Edit and Dashboard Sync Fix

## Issues Fixed

### Issue 1: Inputs Not Editable
**Problem**: Couldn't click or edit text/numbers in the line items table

**Root Cause**: Click events were being captured by parent row's expand/collapse handler

**Solution**: Added `stopPropagation()` to all input fields and their parent cells

### Issue 2: Changes Don't Update Dashboard
**Problem**: When editing document fields (issuer, date, amount, line items), changes saved to document but dashboard income/expenses didn't update

**Root Cause**: 
- Documents and income/expenses are separate entities in Firestore
- When a document is first processed, it creates income/expense entries
- When editing the document, only the document was updated, not the related income/expenses
- No mechanism to sync changes back to dashboard

**Solution**: Implemented complete document-to-dashboard sync system

## How It Works Now

### 1. Document Processing (First Time)
```
User uploads document
    ↓
AI analyzes document
    ↓
Document saved to Firestore
    ↓
Income/Expenses created with documentId link
    ↓
Dashboard shows updated numbers ✅
```

### 2. Document Editing (Updates)
```
User clicks document row to expand
    ↓
User edits fields (issuer, date, amount, line items)
    ↓
User clicks "CERTIFY AND LOCK RECORD" button
    ↓
Document data updated in Firestore
    ↓
handleDocumentUpdated() called
    ↓
Old income/expenses deleted (by documentId)
    ↓
New income/expenses created from updated data
    ↓
Dashboard numbers refresh automatically ✅
```

## New Features

### 1. All Fields Are Editable
You can now edit:
- ✅ **Issuer Entity** - Company/supplier name
- ✅ **Date** - Transaction date
- ✅ **Total Amount** - Main amount
- ✅ **VAT Amount** - Tax amount
- ✅ **Net Amount** - Amount after tax
- ✅ **Currency** - CHF, EUR, USD, etc.
- ✅ **Document Number** - Invoice/receipt number
- ✅ **Category** - Expense category
- ✅ **Line Items** - All fields in the table:
  - Date
  - Description
  - Amount
  - Type (INCOME/EXPENSE)
  - Category

### 2. Real-Time Dashboard Sync
When you save changes:
- ✅ Old income/expenses are deleted
- ✅ New income/expenses are created from updated data
- ✅ Dashboard totals update immediately
- ✅ Balance recalculates automatically
- ✅ Success message confirms update

### 3. Smart Document Linking
- Each income/expense entry stores `documentId`
- When document is edited, system finds all related entries
- Deletes old entries and creates new ones
- Maintains data integrity

## Technical Implementation

### 1. Added `onDocumentUpdated` Handler

**Location**: `components/RestaurantDashboard.tsx`

```typescript
const handleDocumentUpdated = async (documentId: string, newData: FinancialData) => {
  // 1. Delete all existing income/expenses linked to this document
  const oldIncome = income.filter(i => i.documentId === documentId);
  const oldExpenses = expenses.filter(e => e.documentId === documentId);
  
  for (const item of oldIncome) {
    await deleteIncome(item.id);
  }
  for (const item of oldExpenses) {
    await deleteExpense(item.id);
  }
  
  // 2. Re-create income/expenses from updated document data
  // (Same logic as initial document processing)
  
  // 3. Show success message
  alert('✅ Document updated successfully! Dashboard numbers have been refreshed.');
};
```

### 2. Updated DocumentProcessor Component

**Location**: `components/DocumentProcessor.tsx`

```typescript
export const DocumentProcessor: React.FC<{ 
  documents: ProcessedDocument[], 
  updateDocument: (documentId: string, updates: Partial<ProcessedDocument>) => Promise<void>,
  onDataExtracted: (data: any, fileName: string, fileHash?: string, fileRaw?: File) => void,
  onDocumentUpdated?: (documentId: string, newData: FinancialData) => Promise<void> // NEW
}> = ({ documents, updateDocument, onDataExtracted, onDocumentUpdated }) => {
  // ...
  
  onSave={async (newData) => {
    // Update document in Firestore
    await updateDocument(doc.id, { data: newData });
    
    // Update related income/expenses in dashboard
    if (onDocumentUpdated) {
      await onDocumentUpdated(doc.id, newData);
    }
    
    toggleRow(doc.id);
  }}
};
```

### 3. Fixed Input Click Events

**Location**: `components/DocumentProcessor.tsx` - EditableLineItemsTable

```typescript
<td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
  <input 
    value={item.description}
    onChange={e => handleItemChange(originalIdx, 'description', e.target.value)}
    onClick={(e) => e.stopPropagation()}
    className="..."
  />
</td>
```

## User Workflow

### To Edit a Document:

1. **Open Document**
   - Go to Dashboard tab
   - Click on any completed document row
   - Document expands to show editing interface

2. **Edit Fields**
   - Click any field to edit (issuer, date, amount, etc.)
   - Fields highlight with gold border when focused
   - Edit line items table:
     - Click date, description, amount to edit
     - Use dropdowns for type and category
     - Click + Add to add new rows
     - Click 🗑️ to delete rows

3. **Save Changes**
   - Click the pulsing gold button: **"CERTIFY AND LOCK RECORD"**
   - System updates document in Firestore
   - System deletes old income/expenses
   - System creates new income/expenses from updated data
   - Success message appears
   - Dashboard numbers update automatically

4. **Verify Changes**
   - Check dashboard totals (Income, Expenses, Balance)
   - Numbers should reflect your edits
   - Click on income/expense items to see document link

## What Gets Updated

### Bank Statements
- **Line Items**: Each line becomes separate income or expense
- **Totals**: Calculated from line items
- **Categories**: Each line can have different category

### Invoices/Bills
- **Total Amount**: Creates single expense entry
- **Issuer**: Used as description
- **Category**: Determines expense category
- **Date**: Transaction date

### Payslips
- **Gross Pay**: Creates payroll expense
- **Employee Name**: Used in description
- **Components**: Earnings and deductions tracked separately

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    DOCUMENT EDITING                      │
└─────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────┐
│  User clicks "CERTIFY AND LOCK RECORD"                  │
└─────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────┐
│  1. Update document.data in Firestore                   │
│     - Save all field changes                            │
│     - Update line items                                 │
│     - Update metadata                                   │
└─────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────┐
│  2. Call handleDocumentUpdated(documentId, newData)     │
└─────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────┐
│  3. Find all income/expenses with this documentId       │
│     - Filter income array                               │
│     - Filter expenses array                             │
└─────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────┐
│  4. Delete old entries from Firestore                   │
│     - Delete each income entry                          │
│     - Delete each expense entry                         │
└─────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────┐
│  5. Re-create entries from updated document data        │
│     - Parse document type                               │
│     - Extract amounts and descriptions                  │
│     - Create new income/expense entries                 │
│     - Link to documentId                                │
└─────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────┐
│  6. Dashboard auto-refreshes                            │
│     - Context providers detect changes                  │
│     - Components re-render                              │
│     - Totals recalculate                                │
│     - Balance updates                                   │
└─────────────────────────────────────────────────────────┘
```

## Files Modified

1. **components/DocumentProcessor.tsx**
   - Added `onDocumentUpdated` prop
   - Added `stopPropagation()` to all inputs
   - Made save button call update handler

2. **components/RestaurantDashboard.tsx**
   - Added `handleDocumentUpdated()` function
   - Passed handler to DashboardTab
   - DashboardTab passes to DocumentProcessor

## Testing Checklist

- [x] Can click and edit all input fields
- [x] Can edit issuer, date, amount fields
- [x] Can edit line items (date, description, amount, type, category)
- [x] Can add new line items
- [x] Can delete line items
- [x] Save button updates document in Firestore
- [x] Save button triggers dashboard sync
- [x] Old income/expenses are deleted
- [x] New income/expenses are created
- [x] Dashboard totals update immediately
- [x] Balance recalculates correctly
- [x] Success message appears
- [x] Changes persist after page refresh

## Deployment

- Build: ✅ Successful
- Deploy: ✅ Successful
- URL: https://cafe-la-place.web.app

## User Instructions

### How to Edit Documents and Update Dashboard:

1. **Navigate to Dashboard**
   - Select a session from sidebar
   - Go to Dashboard tab

2. **Find Your Document**
   - Scroll to uploaded documents table
   - Look for the document you want to edit
   - Status should be "COMPLETED"

3. **Open Document for Editing**
   - Click on the document row
   - Document expands showing:
     - Document preview (left side)
     - Editing fields (right side)
     - Line items table (bottom)

4. **Edit Any Field**
   - **Top Fields**: Click to edit issuer, date, amounts, currency, category
   - **Line Items Table**: 
     - Click any cell to edit
     - Use search bar to find items
     - Click "+ Add" to add new rows
     - Click 🗑️ to delete rows
     - Click ✓ to mark as verified

5. **Save Your Changes**
   - Scroll to bottom
   - Click the pulsing gold button: **"CERTIFY AND LOCK RECORD"**
   - Wait for success message
   - Document row collapses automatically

6. **Verify Dashboard Updated**
   - Look at dashboard cards at top:
     - Income total
     - Expenses total
     - Payroll total
     - Balance
   - Numbers should reflect your edits
   - Scroll down to income/expense lists
   - Find entries linked to your document

### Tips:

- ✅ **All changes sync to dashboard** - No need to manually update income/expenses
- ✅ **Edit as many times as needed** - Each save updates everything
- ✅ **Line items are powerful** - Edit individual transactions in bank statements
- ✅ **Categories matter** - Choose correct category for proper expense tracking
- ✅ **Dates are important** - Correct dates help with monthly reports
- ✅ **Search is your friend** - Use search bar in line items for long lists

### Common Scenarios:

**Scenario 1: Fix Wrong Amount**
1. Click document row
2. Edit "Total Amount" field
3. Click save button
4. Dashboard updates immediately ✅

**Scenario 2: Change Supplier Name**
1. Click document row
2. Edit "Issuer Entity" field
3. Click save button
4. Expense description updates ✅

**Scenario 3: Edit Bank Statement Line Items**
1. Click document row
2. Scroll to line items table
3. Edit any line (date, description, amount, type)
4. Add or delete lines as needed
5. Click save button
6. All income/expenses update ✅

**Scenario 4: Recategorize Expense**
1. Click document row
2. Change "Category" dropdown
3. Click save button
4. Expense moves to new category ✅

## Status

✅ **COMPLETED** - All features working and deployed

## Previous Related Fixes

- Inputs not editable (stopPropagation fix)
- Line items table styling
- Search and add/delete functionality
- Firebase Storage integration
- Payroll calculation fix

## Next Steps

None - feature is complete and working as expected.

## Notes

- Changes are permanent - old income/expenses are deleted
- Document history is not tracked (consider adding version history in future)
- Large documents with many line items may take a few seconds to update
- Always verify dashboard numbers after editing
- If something goes wrong, check browser console for error messages
