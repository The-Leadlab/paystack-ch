# Quick Admin Setup - 30 Seconds

## The Fastest Way (Use Firebase Console)

1. **Open this link**: https://console.firebase.google.com/project/cafe-la-place/authentication/users

2. **Click "Add user"** button (top right)

3. **Fill in**:
   - Email: `admin@test.com`
   - Password: `cafedelaplace*11`

4. **Click "Add user"**

5. **Done!** Now go to https://cafe-la-place.web.app and login

---

## Why CLI Didn't Work

The Firebase Admin SDK requires service account credentials which need to be downloaded from Firebase Console. It's faster to just create the user directly in the console.

## After Creating

Login at https://cafe-la-place.web.app with:
- Email: `admin@test.com`
- Password: `cafedelaplace*11`

✅ Email verification will be bypassed automatically!
