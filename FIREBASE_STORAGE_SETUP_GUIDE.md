# Firebase Storage Setup Guide - FREE TIER

## ✅ Firebase Storage Free Tier Benefits
- **5 GB storage** (free forever)
- **1 GB/day download** (free)
- **20,000 uploads/day** (free)
- **50,000 downloads/day** (free)

This is MORE than enough for a restaurant! You'd need to upload 20,000 documents per day to exceed the free tier.

## 🚀 Setup Steps

### Step 1: Enable Firebase Storage
1. Go to: https://console.firebase.google.com/project/cafe-la-place/storage
2. Click **"Get Started"** button
3. Click **"Next"** on the security rules dialog (we already have rules configured)
4. Select location: **"europe-west1"** (closest to Switzerland)
5. Click **"Done"**

### Step 2: Deploy Storage Rules
After enabling storage in the console, run:
```bash
npx firebase deploy --only storage
```

This will deploy the security rules from `storage.rules` file.

### Step 3: Build and Deploy Application
```bash
npm run build
npx firebase deploy --only hosting
```

## 📋 Storage Rules (Already Configured)

The `storage.rules` file is already set up with secure rules:

```
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // Documents folder - users can only access their own documents
    match /documents/{userId}/{fileName} {
      // Allow read if authenticated and accessing own documents
      allow read: if request.auth != null && request.auth.uid == userId;
      
      // Allow write if authenticated and writing to own folder
      allow write: if request.auth != null && request.auth.uid == userId;
      
      // Allow delete if authenticated and deleting own documents
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

**Security Features**:
- ✅ Users can only access their own documents
- ✅ Must be authenticated to upload/download
- ✅ Files organized by user ID
- ✅ No public access

## 🎯 How It Works

### File Upload Flow
1. User uploads document (PDF/JPG/PNG)
2. Document is analyzed by Gemini AI
3. File is uploaded to Firebase Storage: `documents/{userId}/{timestamp}_{filename}`
4. Download URL is saved in Firestore document
5. File can be viewed anytime (even after page refresh!)

### File Storage Structure
```
documents/
  └── {userId}/
      ├── 1713312000000_invoice.pdf
      ├── 1713312001000_receipt.jpg
      └── 1713312002000_payslip.pdf
```

### Firestore Document Structure
```json
{
  "id": "abc123",
  "fileName": "invoice.pdf",
  "status": "completed",
  "fileUrl": "https://firebasestorage.googleapis.com/v0/b/cafe-la-place.firebasestorage.app/o/documents%2F{userId}%2F1713312000000_invoice.pdf?alt=media&token=...",
  "fileHash": "sha256hash...",
  "data": { /* extracted financial data */ }
}
```

## 📊 Storage Usage Estimates

### Typical Restaurant Usage
- **Average document size**: 500 KB
- **Documents per day**: 10-20
- **Monthly storage**: ~300 MB
- **Monthly downloads**: ~1 GB

**Conclusion**: Well within the 5 GB free tier! 🎉

### When You'd Exceed Free Tier
- Upload 10,000+ documents (5 GB / 500 KB = 10,000 docs)
- Download 1 GB+ per day (very unlikely for a single restaurant)

## 🔧 Implementation Details

### New Service: `services/storageService.ts`
```typescript
// Upload file to Firebase Storage
export async function uploadDocument(
  file: File,
  userId: string,
  fileName: string
): Promise<string> {
  // Returns download URL
}

// Delete file from Firebase Storage
export async function deleteDocument(fileUrl: string): Promise<void> {
  // Deletes file by URL
}
```

### Updated Components
1. **DocumentProcessor.tsx**
   - Passes `fileRaw` (File object) instead of base64
   - No more size limit errors

2. **RestaurantDashboard.tsx**
   - Uploads file to Firebase Storage
   - Saves download URL in Firestore
   - Handles upload errors gracefully

3. **types.ts**
   - Added `fileUrl` field to ProcessedDocument
   - Kept `fileDataUrl` for backward compatibility

## ✅ Benefits

### Before (Base64 in Firestore)
- ❌ 11 MB size limit
- ❌ Large documents failed
- ❌ Slow queries (large documents)
- ❌ Expensive Firestore reads

### After (Firebase Storage)
- ✅ No size limit (up to 5 GB total)
- ✅ All documents work
- ✅ Fast queries (only URLs in Firestore)
- ✅ Cheap storage ($0.026/GB after free tier)
- ✅ Files persist after page refresh
- ✅ Can view documents anytime
- ✅ Can share document links

## 🎉 User Experience

### Before
1. Upload document ✅
2. Process document ✅
3. View document ✅
4. Refresh page ❌ (file lost)
5. Open in new tab ❌ (file lost)

### After
1. Upload document ✅
2. Process document ✅
3. View document ✅
4. Refresh page ✅ (file still there!)
5. Open in new tab ✅ (file still there!)
6. View document next week ✅ (file still there!)

## 🔮 Future Enhancements

1. **Bulk Download**
   - Download all documents as ZIP
   - Export with original files

2. **Document Sharing**
   - Generate shareable links
   - Time-limited access

3. **File Management**
   - Delete old documents
   - Archive by date range
   - Storage usage dashboard

4. **Backup**
   - Auto-backup to Google Drive
   - Export to external storage

## 📞 Support

If you encounter any issues:
1. Check browser console (F12) for errors
2. Verify Firebase Storage is enabled in console
3. Check storage rules are deployed
4. Verify user is authenticated

## 🎯 Next Steps

1. ✅ Enable Firebase Storage in console (Step 1 above)
2. ✅ Deploy storage rules: `npx firebase deploy --only storage`
3. ✅ Build and deploy: `npm run build && npx firebase deploy --only hosting`
4. ✅ Test by uploading a document
5. ✅ Refresh page and verify document is still viewable

## 💰 Cost Breakdown (After Free Tier)

If you somehow exceed the free tier:
- **Storage**: $0.026/GB/month (~$0.13 for 5 GB)
- **Download**: $0.12/GB (~$3.60 for 30 GB/month)
- **Upload**: $0.05/GB (~$1.50 for 30 GB/month)

**Realistic monthly cost**: $0 (within free tier) 🎉
