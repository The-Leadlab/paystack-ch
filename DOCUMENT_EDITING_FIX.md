# Document Editing & Save Button Fix

## Issue
Users couldn't modify numbers in the document verification view or find the "Certify and Lock Record" button to save changes.

## Problems Identified

### 1. Save Button Not Visible
- Button was at the bottom of a scrollable area
- Users had to scroll down to find it
- Not obvious that changes needed to be saved

### 2. Line Items Are Editable But Not Obvious
- Line items table allows editing (click on values)
- But no visual indication that fields are editable
- No confirmation that changes are being tracked

## Solution Implemented

### 1. Made Save Button Sticky & Prominent
**Before**:
```typescript
<div className="pt-6 border-t border-cdlp-border mt-6">
  <button onClick={() => onSave(...)}>
    Certify and Lock Record
  </button>
</div>
```

**After**:
```typescript
{/* Sticky Save Button - Always Visible */}
<div className="sticky bottom-0 pt-6 pb-2 border-t border-cdlp-border mt-6 bg-cdlp-black">
  <button 
    onClick={() => onSave({ ...editedData, isHumanVerified: true })} 
    className="... animate-pulse"  // Pulsing animation to draw attention
  >
    <ShieldCheck className="w-5 h-5" /> Certify and Lock Record
  </button>
  <p className="text-center text-[8px] text-cdlp-muted mt-2">
    Click to save all changes to this document
  </p>
</div>
```

### 2. Added Max Height to Scrollable Area
```typescript
<div className="flex-1 overflow-y-auto mt-6 min-h-[300px] max-h-[400px] custom-scrollbar">
  {/* Line items table */}
</div>
```

This ensures the save button is always visible below the table.

## How to Edit Documents

### Step 1: Expand Document
1. Go to Documents tab
2. Click on a completed document row
3. Document verification view opens

### Step 2: Edit Values
**Editable Fields**:
- ✅ Issuer Entity
- ✅ Currency
- ✅ Document Number
- ✅ Total Amount
- ✅ VAT Amount
- ✅ Net Amount
- ✅ Date
- ✅ Category

**Editable Line Items** (click to edit):
- ✅ Date
- ✅ Description
- ✅ Amount
- ✅ Type (Income/Expense)
- ✅ Category

**Bank Statement Fields**:
- ✅ Opening Balance
- ✅ Income Total
- ✅ Expense Total
- ✅ Final Balance

**Pay Slip Fields**:
- ✅ Employee Name
- ✅ Employee ID
- ✅ Employer Name
- ✅ Period Start/End
- ✅ Pay Date
- ✅ All pay components (earnings/deductions)

### Step 3: Save Changes
1. Scroll to bottom (or button is sticky and visible)
2. Click **"Certify and Lock Record"** button (pulsing gold button)
3. Changes are saved to Firestore
4. Document marked as human-verified

## Visual Improvements

### Save Button
- **Color**: Gold (cdlp-gold) - stands out
- **Animation**: Pulsing effect - draws attention
- **Size**: Large (h-14) - easy to click
- **Position**: Sticky bottom - always visible
- **Help Text**: "Click to save all changes" - clear instruction

### Line Items Table
- **Verify Column**: Checkboxes to mark items as verified
- **Editable Fields**: Click to edit (border appears on focus)
- **Color Coding**: 
  - Green for income
  - Red for expenses
  - Emerald background when verified

## Current Limitations

### What Gets Saved
When you click "Certify and Lock Record":
- ✅ Document data is updated in Firestore
- ✅ All field changes are saved
- ✅ Line item changes are saved
- ❌ **Does NOT update** the original income/expense entries

### Why This Matters
If you change a line item amount from 100 to 150:
- ✅ Document shows 150
- ❌ Dashboard still shows 100 (original income/expense entry)

### Workaround
To update dashboard numbers:
1. Go to Dashboard tab
2. Find the income/expense item
3. Hover over it
4. Click Edit (✏️) button
5. Change the amount
6. Click Save

## Future Enhancement

To make document edits update dashboard automatically, we would need to:

1. **Track Relationships**
   - Store which income/expense entries came from which document
   - Already have `document_id` field in income/expenses

2. **Update on Save**
   - When document is saved, find related income/expenses
   - Update their amounts to match document changes
   - Recalculate totals

3. **Implementation**
   ```typescript
   onSave={async (newData) => {
     // Save document
     await updateDocument(doc.id, { data: newData });
     
     // Find and update related income/expenses
     const relatedIncome = income.filter(i => i.document_id === doc.id);
     const relatedExpenses = expenses.filter(e => e.document_id === doc.id);
     
     // Update amounts based on newData.lineItems
     for (const item of newData.lineItems) {
       if (item.type === 'INCOME') {
         await updateIncome(relatedIncome[0].id, { amount: item.amount });
       } else {
         await updateExpense(relatedExpenses[0].id, { amount: item.amount });
       }
     }
   }}
   ```

## Testing

### Test Case 1: Edit Document Fields
1. Open document
2. Change Total Amount from 100 to 150
3. Scroll down
4. ✅ Save button is visible and pulsing
5. Click "Certify and Lock Record"
6. ✅ Changes saved
7. Refresh page
8. ✅ Changes persist

### Test Case 2: Edit Line Items
1. Open document with line items
2. Click on an amount field
3. Change value
4. Click on description field
5. Change text
6. ✅ Save button visible at bottom
7. Click "Certify and Lock Record"
8. ✅ Changes saved

### Test Case 3: Verify Button Always Visible
1. Open document with many line items
2. Scroll through table
3. ✅ Save button stays visible at bottom
4. Make changes
5. ✅ Can immediately click save without scrolling

## Files Modified
- `components/DocumentProcessor.tsx` - Made save button sticky and prominent

## Status
✅ **FIXED** - Save button now always visible and prominent

## Deployed
- Build: ✅ Successful
- Deploy: ✅ Successful
- URL: https://cafe-la-place.web.app

## User Instructions

### To Edit a Document:
1. Go to **Documents** tab
2. Click on a completed document
3. Edit any fields you want
4. Edit line items by clicking on them
5. Look for the **pulsing gold button** at the bottom
6. Click **"Certify and Lock Record"**
7. Done! Changes are saved

### To Edit Dashboard Numbers:
1. Go to **Dashboard** tab
2. Find the income or expense item
3. Hover over it
4. Click **Edit (✏️)** button
5. Change the values
6. Click **Save**
7. Numbers update immediately

### Note:
Editing a document does NOT automatically update dashboard numbers. You need to edit them separately in the Dashboard tab if you want the totals to change.
