# Firebase Storage Setup Instructions

## ✅ Code Changes Completed

The following changes have been implemented and deployed:

### 1. **Firebase Storage Integration**
- Added Firebase Storage to `lib/firebase.ts`
- Created `services/storageService.ts` with upload/delete functions
- Updated `types.ts` to include `fileUrl` and `filePath` fields
- Modified `DocumentProcessor.tsx` to upload files during processing
- Updated `RestaurantDashboard.tsx` to handle file URLs

### 2. **Improved Revenue Detection**
- Enhanced AI prompt to better distinguish INCOME vs EXPENSE
- Added automatic revenue detection for:
  - Documents with "REVENUE" or "SALES" category
  - Ticket/Receipt documents
  - Z2 Multi-Ticket Sheet documents
- Revenue documents now automatically create income entries

### 3. **Document Viewing**
- Documents now display using `fileUrl` from Firebase Storage
- Fallback to `fileRaw` for documents in current session
- Proper handling of both PDF and image files
- "Open in new tab" functionality works with stored URLs

### 4. **Security Rules**
- Created `storage.rules` with user-specific access control
- Users can only read/write/delete their own documents

---

## 🔧 Required Manual Steps

### Step 1: Enable Firebase Storage

1. Go to [Firebase Console](https://console.firebase.google.com/project/cafe-la-place/storage)
2. Click **"Get Started"** button
3. Choose **"Start in production mode"** (we have custom rules)
4. Select a location (choose same as Firestore: `europe-west1` or similar)
5. Click **"Done"**

### Step 2: Deploy Storage Rules

After enabling Storage in the console, run:

```bash
npx firebase deploy --only storage
```

This will deploy the security rules from `storage.rules`.

### Step 3: Verify Storage Rules

The deployed rules ensure:
- Users can only access documents in their own folder (`documents/{userId}/`)
- Authentication is required for all operations
- Each user's documents are isolated

---

## 📋 How It Works

### Document Upload Flow

1. **User uploads document** → DocumentProcessor
2. **File is uploaded to Firebase Storage** → `documents/{userId}/{timestamp}_{filename}`
3. **Download URL is generated** → Stored in Firestore as `fileUrl`
4. **AI processes document** → Extracts financial data
5. **Document saved to Firestore** → With both data and file URL

### Document Viewing Flow

1. **User clicks document** → Opens detail view
2. **System checks for `fileUrl`** → Uses Storage URL if available
3. **Fallback to `fileRaw`** → For documents in current session
4. **Display in iframe/img** → Based on file type (PDF/image)
5. **"Open in new tab"** → Opens the Storage URL

---

## 🎯 Benefits

### Before (Without Storage)
- ❌ Files lost after page refresh
- ❌ Can't view old documents
- ❌ Only extracted data persisted
- ❌ No file backup

### After (With Storage)
- ✅ Files permanently stored
- ✅ Can view any document anytime
- ✅ Both data and files persisted
- ✅ Automatic file backup
- ✅ Secure user-specific access

---

## 🔍 Testing

After enabling Storage and deploying rules:

1. **Upload a new document**
   - Should see file upload progress in console
   - Document should be viewable immediately
   - File URL should be stored in Firestore

2. **Refresh page**
   - Document should still be viewable
   - File should load from Storage URL
   - No "file not available" message

3. **Open in new tab**
   - Should open the document in new browser tab
   - URL should be from Firebase Storage domain

4. **Check Firebase Console**
   - Go to Storage tab
   - Should see files in `documents/{userId}/` folder
   - Each file should have timestamp prefix

---

## 📊 Storage Costs

Firebase Storage pricing (as of 2026):
- **Storage**: $0.026/GB per month
- **Download**: $0.12/GB
- **Upload**: Free

**Estimated costs for restaurant:**
- 100 documents/month × 500KB average = 50MB/month
- Storage cost: ~$0.001/month (negligible)
- Download cost: Minimal (documents viewed occasionally)

**Free tier includes:**
- 5GB storage
- 1GB/day downloads
- 20K/day uploads

---

## 🚨 Important Notes

1. **Old Documents**: Documents uploaded before this update won't have files stored. Only new uploads will be saved to Storage.

2. **File Retention**: Files are stored permanently unless manually deleted. Consider implementing cleanup for deleted documents.

3. **Security**: Storage rules ensure users can only access their own files. Never share Storage URLs publicly.

4. **Backup**: Firebase Storage provides automatic redundancy and backup. No additional backup needed.

---

## 🔄 Next Steps

After enabling Storage:

1. Test with a new document upload
2. Verify file appears in Storage console
3. Confirm document viewing works
4. Check "Open in new tab" functionality
5. Test with different file types (PDF, JPG, PNG)

---

**Status**: Code deployed ✅ | Storage setup required ⏳

**Deployment URL**: https://cafe-la-place.web.app
