# Google Drive + Firebase Admin — Setup Guide

Google OAuth **works** in the browser; Paystack **cannot finish** the connection until the server can write to Firestore with the **Firebase Admin SDK**.

## Symptom

- Billing → Google Drive shows: **"Server missing Firebase Admin credentials"**
- Or after Google consent: toast *"Google sign-in worked, but Paystack could not save the connection…"*

## Why

| Step | Needs |
|------|--------|
| `POST /api/oauth/google/start` | Firebase ID token only ✅ |
| `GET /api/oauth/google/callback` | **Admin SDK** to store `refreshToken` + `folderId` on `users/{uid}` ❌ without service account |

## Fix (Vercel Production)

### 1. Create a service account key (GCP)

1. Open [Google Cloud Console](https://console.cloud.google.com/) → project **paystack-ch** (or your Firebase project).
2. **IAM & Admin** → **Service Accounts**.
3. Use the default **Firebase Admin SDK** service account, or create one with role **Firebase Admin SDK Administrator Service Agent** (or **Cloud Datastore User** + Firestore access).
4. **Keys** → **Add key** → **Create new key** → **JSON** → download.

> If your org blocks key creation (`iam.disableServiceAccountKeyCreation`), ask an org admin for an exception on project `paystack-ch`, or use Workload Identity on a non-Vercel host.

### 2. Add to Vercel

**Settings** → **Environment Variables** → **Production**:

| Name | Value |
|------|--------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Entire JSON file as **one line** (minified) |

**Or** base64-encode the file:

```bash
# macOS / Linux
base64 -i service-account.json | tr -d '\n'
```

Set as `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`.

Also confirm these exist:

| Variable | Example |
|----------|---------|
| `GOOGLE_DRIVE_CLIENT_ID` | `….apps.googleusercontent.com` |
| `GOOGLE_DRIVE_CLIENT_SECRET` | `GOCSPX-…` |
| `GOOGLE_DRIVE_REDIRECT_URI` | `https://paystack.ch/api/oauth/google/callback` |
| `GOOGLE_DRIVE_STATE_SECRET` | Random string ≥ 16 chars |
| `PUBLIC_APP_URL` | `https://paystack.ch` |

### 3. Google Cloud OAuth client

**APIs & Services** → **Credentials** → your OAuth client → **Authorized redirect URIs**:

```
https://paystack.ch/api/oauth/google/callback
```

Must match `GOOGLE_DRIVE_REDIRECT_URI` exactly.

Enable **Google Drive API** for the project.

### 4. Redeploy

Trigger a new Vercel deployment after saving env vars.

### 5. Test

1. `/app` → **Billing** → warning should disappear from Google Drive panel
2. **Connect Google Drive** → Google consent → success toast
3. Check Firestore `users/{your-uid}` → field `googleDrive.refreshToken`

## Local dev

Same vars in `.env`, plus:

```
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/api/oauth/google/callback
PUBLIC_APP_URL=http://localhost:3000
```

Run `pnpm dev` and `pnpm dev:stripe-server` (port 8787 proxies `/api/oauth`).

## Security

- Never commit the JSON key or put it in `VITE_*` variables.
- Rotate keys if leaked.
- Refresh tokens live only in Firestore (server-written); clients never see them.
