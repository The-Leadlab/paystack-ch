<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/15QnuoLKENugMr5sZ_laPkASgpASWNH2v

## Run Locally

**Prerequisites:** Node.js

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment variables**  
   Copy [.env.example](.env.example) to `.env.local` and fill in:
   - `VITE_GEMINI_API_KEY` – for document AI ([Google AI](https://ai.google.dev/))
   - Firebase config – see [Firebase setup](#firebase-setup) below  
   On **Netlify**, add the same keys under Site settings → Environment variables, then redeploy.

3. **Firebase setup**  
   See [Firebase setup](#firebase-setup) to create a project and get auth + Firestore working.

4. **Run the app**
   ```bash
   npm run dev
   ```

### Firebase setup

1. **Create a project** at [Firebase Console](https://console.firebase.google.com/).
2. **Add a web app** (Project overview → Add app → Web). Copy the `firebaseConfig` object.
3. **Environment variables** – In `.env.local`, set:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID` (optional, for Analytics)
4. **Authentication** – In Firebase Console → Build → Authentication → Get started → Sign-in method → Enable **Email/Password**.
5. **Firestore** – In Build → Firestore Database → Create database → Start in **test mode** (or production with rules below).  
   The app creates the `clients` collection automatically. If the first query asks for an index, click the link in the browser console to create it (Firestore will open the correct index page).

**Optional – Firestore security rules** (Firestore → Rules) so only signed-in users can read/write their own clients:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /clients/{docId} {
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
  }
}
```

### Flow

- **Sign in / Sign up** with email and password.
- **Client**: On first use you’re asked for a client name; it’s saved in Firestore. You can add more clients and switch between them from the header.
- **Audit & Insights**: Use the dashboard as before (document processing, insights).
