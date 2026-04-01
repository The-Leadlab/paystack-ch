// One-time script to create admin user
// Run with: node create-admin.js

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCrgmBjFR8AyYZHn37XBTpz7-7fK-uvYDY",
  authDomain: "cafe-la-place.firebaseapp.com",
  projectId: "cafe-la-place",
  storageBucket: "cafe-la-place.firebasestorage.app",
  messagingSenderId: "212199909940",
  appId: "1:212199909940:web:dddac3b3ab42dd23103861"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function createAdmin() {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      'admin@test.com',
      'admin'
    );
    console.log('✅ Admin user created successfully!');
    console.log('Email: admin@test.com');
    console.log('Password: admin');
    console.log('UID:', userCredential.user.uid);
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('ℹ️  Admin user already exists');
      console.log('Email: admin@test.com');
      console.log('Password: admin');
    } else {
      console.error('❌ Error creating admin:', error.message);
    }
    process.exit(1);
  }
}

createAdmin();
