# Admin Account Setup Instructions

## The Issue
You're seeing "Error (auth/invalid-credential)" because the admin account doesn't exist yet in Firebase Authentication.

## ✅ EASIEST SOLUTION: Use the Sign Up Page

1. Go to: https://cafe-la-place.web.app
2. Click "DON'T HAVE AN ACCOUNT? SIGN UP" at the bottom
3. Fill in the form:
   - **Username**: Admin (or any name you want)
   - **Email**: `admin@test.com`
   - **Password**: `cafedelaplace*11`
4. Click "SIGN UP"
5. You'll see a message about verification email
6. Now click "Already have an account? Sign in"
7. Login with:
   - **Email**: `admin@test.com`
   - **Password**: `cafedelaplace*11`
8. ✅ You'll be logged in immediately (bypassing email verification)

## Alternative: Firebase Console

1. Go to: https://console.firebase.google.com/project/cafe-la-place/authentication/users
2. Click "Add user" button
3. Enter:
   - **Email**: `admin@test.com`
   - **Password**: `cafedelaplace*11`
4. Click "Add user"
5. Go back to https://cafe-la-place.web.app and login

## Why This Happens

The admin bypass code checks if the logged-in user's email is `admin@test.com` and automatically bypasses email verification. However, Firebase still needs to authenticate the credentials first, which means the account must exist in the database.

## After Setup

Once created, you can always login with:
- Email: `admin@test.com`
- Password: `cafedelaplace*11`

No email verification required! 🎉

## Security Note

For production use, consider:
1. Using Firebase Custom Claims for admin roles
2. Storing admin credentials in environment variables
3. Implementing proper role-based access control (RBAC)
4. Using Firebase Admin SDK for user management
