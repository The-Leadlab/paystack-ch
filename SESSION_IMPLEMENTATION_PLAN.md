# Session System Implementation Plan

## Files to Update

### 1. ✅ types.ts - DONE
- Added Session interface
- Added session_id to Income, Expense, ProcessedDocument
- Added POSRevenueReport interface
- Added POS_REVENUE_REPORT to DocumentType enum
- Added fileHash and isScanned to ProcessedDocument

### 2. ✅ context/SessionContext.tsx - DONE
- Created new context for session management
- Auto-create session with timestamp
- Resume last active session
- Delete, rename sessions
- All Sessions view toggle

### 3. ✅ context/EmployeeContext.tsx - DONE
- Add session_id parameter (optional for global employees)
- Filter employees by session when needed

### 4. ✅ context/FinanceContext.tsx - DONE
- Add session_id to addIncome/addExpense
- Filter income/expenses by current session
- Support "All Sessions" view

### 5. ✅ App.tsx - DONE
- Wrap with SessionProvider
- Auto-create first session if none exist

### 6. ✅ components/RestaurantDashboard.tsx - DONE
- Replace employee sidebar with session sidebar
- Add "Add Session" button
- Show session list with rename/delete
- Add "All Sessions" tab with reset button
- Filter all data by current session
- Add Revenue tab for POS reports
- Update document processing for POS reports
- Add duplicate file detection (UI ready, needs backend)

### 7. ⚠️ components/QuickDocumentUpload.tsx - PARTIAL
- Add session_id to uploaded documents ✅
- Calculate file hash for duplicate detection ⏳
- Check if file already scanned in session ⏳

### 8. ✅ services/geminiService.ts - DONE
- Added POS Revenue Report extraction
- Added posReport schema to document analysis
- Updated prompt with Z-reading instructions

### 9. ✅ FEATURES.md - DONE
- Updated with session system
- Added POS Revenue Report documentation
- Added manual adjustment feature
- Updated tab navigation

## Implementation Status

### ✅ COMPLETED
- Session management system with auto-naming
- Session sidebar with rename/delete
- All Sessions view with reset button
- Revenue tab with POS report display
- POS report detail view with manual adjustment
- AI extraction for Z-readings
- Payment method breakdown
- Tax itemization
- Revenue validation

### ⏳ REMAINING
- File hash calculation for duplicate detection
- Visual indicator for already-scanned files
- Backend storage for file hashes

## Key Features

### Session Management ✅
- Auto-named with timestamp (YYYY-MM-DD HH:MM:SS)
- Rename capability
- Delete capability
- Resume last active session
- "All Sessions" view aggregates all data
- Reset button to exit All Sessions view

### Data Scoping ✅
- Income/Expenses filtered by session
- Documents linked to session
- Employees global but can be assigned to sessions

### POS Revenue Reports ✅
- Extract Z-reading data
- Revenue tab separate from expenses
- Manual adjustment field with reason
- Payment method breakdown (cash, card, other)
- Tax itemization with individual VAT rates
- Cancellations & discounts tracking
- Tips separated from revenue
- Revenue validation (flags mismatches)

### Duplicate Prevention ⏳
- File hash calculation (TODO)
- Check if file already scanned in session (TODO)
- Visual indicator for scanned files (TODO)

## Next Steps
1. Implement file hashing in QuickDocumentUpload.tsx
2. Add visual indicators for scanned files
3. Test POS report extraction with real Z-readings
4. Test session switching and data filtering

## Deployment
✅ Deployed to: https://cafe-la-place.web.app
