// Create admin user using Firebase Admin SDK
// Run with: node create-admin-cli.js

import admin from 'firebase-admin';

// Initialize Firebase Admin with your service account
// You can download the service account key from:
// https://console.firebase.google.com/project/cafe-la-place/settings/serviceaccounts/adminsdk

try {
  // Try to initialize with application default credentials
  admin.initializeApp({
    projectId: 'cafe-la-place'
  });
} catch (error) {
  console.log('Note: Using default credentials. If this fails, download service account key.');
}

async function createAdminUser() {
  try {
    const userRecord = await admin.auth().createUser({
      email: 'admin@test.com',
      password: 'cafedelaplace*11',
      emailVerified: true, // Mark as verified
      displayName: 'Admin',
      disabled: false
    });

    console.log('✅ Successfully created admin user:');
    console.log('   Email:', userRecord.email);
    console.log('   UID:', userRecord.uid);
    console.log('   Email Verified:', userRecord.emailVerified);
    console.log('\n🔓 You can now login with:');
    console.log('   Email: admin@test.com');
    console.log('   Password: cafedelaplace*11');
    console.log('\n✨ This account bypasses email verification automatically!');
    
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      console.log('ℹ️  Admin user already exists!');
      console.log('\n🔓 You can login with:');
      console.log('   Email: admin@test.com');
      console.log('   Password: cafedelaplace*11');
      process.exit(0);
    } else {
      console.error('❌ Error creating admin user:', error.message);
      console.error('\nTroubleshooting:');
      console.error('1. Make sure you have firebase-admin installed: npm install firebase-admin');
      console.error('2. Download service account key from Firebase Console');
      console.error('3. Set GOOGLE_APPLICATION_CREDENTIALS environment variable');
      console.error('4. Or use the Firebase Console to create the user manually');
      process.exit(1);
    }
  }
}

createAdminUser();
