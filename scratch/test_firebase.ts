import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve('.env') });

const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

console.log('Testing configuration:', { ...config, apiKey: '***' });

async function runTest() {
  try {
    const app = initializeApp(config);
    const db = getFirestore(app);
    console.log('Firebase App initialized successfully.');

    // Try Firestore write
    const testDoc = doc(db, 'billease_test', 'startup_check');
    console.log('Attempting Firestore write...');
    await setDoc(testDoc, {
      status: 'success',
      timestamp: new Date().toISOString()
    });
    console.log('Firestore write: SUCCESS');

    // Try Firestore read
    console.log('Attempting Firestore read...');
    const snap = await getDoc(testDoc);
    if (snap.exists()) {
      console.log('Firestore read: SUCCESS, data:', snap.data());
    } else {
      console.log('Firestore read: FAILED (doc not found)');
    }

    // Try Storage upload
    console.log('Attempting Storage upload...');
    const storage = getStorage(app);
    const storageRef = ref(storage, 'test/startup_check.txt');
    const blob = Buffer.from('Firebase storage check success', 'utf-8');
    await uploadBytes(storageRef, blob);
    console.log('Storage upload: SUCCESS');

    // Try Storage download URL
    const url = await getDownloadURL(storageRef);
    console.log('Storage download URL: SUCCESS, URL:', url);

  } catch (err) {
    console.error('Firebase connection test failed:', err);
    process.exit(1);
  }
}

runTest();
