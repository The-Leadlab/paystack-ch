# Create Admin Account

## Issue
The admin account `admin@test.com` doesn't exist in Firebase Authentication yet.

## Solution

You have 2 options:

### Option 1: Create via Firebase Console (Recommended)
1. Go to Firebase Console: https://console.firebase.google.com/project/cafe-la-place/authentication/users
2. Click "Add user"
3. Enter:
   - Email: `admin@test.com`
   - Password: `cafedelaplace*11`
4. Click "Add user"
5. The account will be created and you can login immediately

### Option 2: Create via Sign Up Page
1. Go to https://cafe-la-place.web.app
2. Click "Don't have an account? Sign up"
3. Enter:
   - Username: `Admin`
   - Email: `admin@test.com`
   - Password: `cafedelaplace*11`
4. Click "Sign up"
5. You'll receive a verification email, but since the code checks for admin email, you can login immediately without verifying

### Option 3: Use the create-admin.js script
Run the existing script:
```bash
node create-admin.js
```

This will create the admin account programmatically.

## After Creating the Account

Once the account is created, you can login with:
- Email: `admin@test.com`
- Password: `cafedelaplace*11`

The system will automatically bypass email verification for this account.

## Note
The admin bypass only works AFTER the account exists in Firebase. The code checks if the logged-in user's email is `admin@test.com` and bypasses verification, but Firebase still needs to authenticate the credentials first.
