# Testing Guide - All Fixes Ready

## 🚀 Quick Start

Your local dev server is already running at: **http://localhost:3000/**

All code fixes are complete. You just need to:
1. Deploy Firestore indexes (one command)
2. Test the features

---

## 📦 Step 1: Deploy Firestore Indexes (REQUIRED)

Open a new terminal and run:

```bash
# If you have Firebase CLI installed globally
firebase deploy --only firestore:indexes

# OR if you need to install it first
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:indexes
```

**Expected Output**:
```
✔ Deploy complete!
```

**Alternative Method** (if command doesn't work):
1. Open the app in browser
2. Log in
3. Upload a document
4. Open browser console (F12)
5. Look for Firestore error with a link
6. Click the link to auto-create the index

---

## 🧪 Step 2: Test Each Fix

### Test A: Payroll Double-Counting ✅

**What was fixed**: Payslips were being deducted twice (as salaries AND expenses)

**How to test**:
1. Go to Dashboard tab
2. Note current Balance amount
3. Upload a payslip (any Swiss payslip PDF)
4. Wait for processing to complete
5. Check the cards:
   - **Payroll card**: Should show the net pay from payslip
   - **Expenses card**: Should include the payroll amount
   - **Balance card**: Should be `Income - Expenses` (payroll NOT deducted separately)

**Expected Result**: Balance decreases by the payroll amount ONCE, not twice.

---

### Test B: Duplicate Detection ✅

**What was fixed**: System now detects duplicate files by name AND content

**How to test**:

**Test B1 - Same File Twice**:
1. Upload any document (e.g., `invoice.pdf`)
2. Wait for it to process
3. Try uploading the EXACT same file again
4. **Expected**: Red error banner appears: "Ignored: 1 duplicate file(s) detected (same content)"

**Test B2 - Same Content, Different Name**:
1. Take the same file from Test B1
2. Rename it (e.g., `invoice_copy.pdf`)
3. Try uploading the renamed file
4. **Expected**: Red error banner: "Ignored: 1 duplicate file(s) detected (same content)"

**Test B3 - Different Content, Same Name**:
1. Create a different PDF with the same filename
2. Try uploading it
3. **Expected**: Red error banner: "Ignored: 1 duplicate filename(s)"

---

### Test C: Excel Export ✅

**What was fixed**: Excel export button is now functional

**How to test**:
1. Upload 2-3 different documents (invoices, payslips, etc.)
2. Wait for all to process (green checkmarks)
3. Scroll to bottom of document table
4. Click **"Export to Excel"** button
5. **Expected**: 
   - Excel file downloads: `Restaurant_Documents_2026-04-01.xlsx`
   - File opens in Excel/Sheets
   - Contains all documents with columns:
     - Audit Date
     - Issuer Entity
     - Document Ref #
     - Original Amount
     - VAT Amount
     - Historical Exchange Rate
     - Audited Total (CHF)
     - Diagnostic Notes
   - Grand total at bottom

---

### Test D: Documents Persistence ✅

**What was fixed**: Documents now persist after logout/login

**⚠️ REQUIRES**: Firestore indexes deployed (Step 1)

**How to test**:
1. Upload 3-4 documents
2. Wait for processing
3. Go to **Documents tab** - verify they appear
4. Click **Logout** button (bottom left sidebar)
5. Log back in with same credentials
6. **Expected**:
   - All documents still visible in Dashboard
   - All documents visible in Documents tab
   - No console errors about indexes
   - Documents organized by supplier/employee

**If documents disappear**:
- Check browser console (F12) for Firestore index error
- Click the link in the error to create index
- OR run: `firebase deploy --only firestore:indexes`

---

## 🎯 Quick Verification Checklist

After testing, verify:

- [ ] Payroll appears in Expenses card
- [ ] Balance = Income - Expenses (not double-deducted)
- [ ] Uploading same file twice shows error
- [ ] Excel export downloads successfully
- [ ] Excel file contains all document data
- [ ] Documents persist after logout/login
- [ ] No console errors about Firestore indexes
- [ ] Documents tab shows suppliers/employees correctly

---

## 🐛 Troubleshooting

### Issue: "Documents disappear after logout"
**Solution**: Deploy Firestore indexes
```bash
firebase deploy --only firestore:indexes
```

### Issue: "Excel export button disabled"
**Cause**: No completed documents
**Solution**: Upload and process at least one document first

### Issue: "Duplicate detection not working"
**Check**: 
1. Browser console for errors
2. Make sure you're uploading the EXACT same file
3. Try with a small test PDF

### Issue: "Balance still wrong"
**Check**:
1. Clear browser cache
2. Refresh page (Ctrl+F5)
3. Check that payslip created PAYROLL expense (not separate salary entry)

---

## 📊 Expected Behavior Summary

| Feature | Before | After |
|---------|--------|-------|
| Payroll | Deducted twice | Deducted once (in expenses) |
| Duplicates | Allowed | Blocked with error message |
| Excel Export | Not working | Downloads with all data |
| Persistence | Lost on logout | Saved to Firestore |

---

## ✅ All Done!

Once all tests pass, the system is ready for production deployment:

```bash
npm run build
firebase deploy
```

Your production URL: **https://cafe-la-place.web.app**
