# Firebase Setup Guide for BillEase

You've added the Firebase credentials to `.env`. Now complete these steps in the Firebase Console to enable data sync and storage.

## Step 1: Enable Firestore Database

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (BillEase)
3. In the left sidebar, click **Build** → **Firestore Database**
4. Click **Create database**
5. Choose region: **asia-south1** (India - closest to your location)
6. Security rules: Select **Start in test mode** (we'll secure it later)
7. Click **Create**
8. Wait for the database to initialize (takes ~1 min)

✅ Firestore is now ready. Collections will be created automatically when data is first written.

---

## Step 2: Enable Cloud Storage

1. In the left sidebar, click **Build** → **Cloud Storage**
2. Click **Get started**
3. Choose region: **asia-south1** (same as Firestore)
4. Security rules: Select **Start in test mode**
5. Click **Create**
6. Wait for initialization (~1 min)

✅ Cloud Storage is now ready for PDF/PNG uploads.

---

## Step 3: Set Up Security Rules (Important!)

### Firestore Rules

1. Go to **Firestore Database** → **Rules** tab
2. Replace the entire content with:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Allow all reads/writes for now (test mode)
    // Later, add authentication checks here
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Click **Publish**

### Cloud Storage Rules

1. Go to **Cloud Storage** → **Rules** tab
2. Replace the entire content with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow all reads/writes for test
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

3. Click **Publish**

⚠️ **Warning:** Test mode rules allow anyone to read/write. Before production, implement proper authentication.

---

## Step 4: Verify Connection in BillEase App

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Open the app in browser (e.g., `http://localhost:5173`)

3. Create a test invoice:
   - Go to Invoices → New Invoice
   - Add a customer and item
   - Save the invoice

4. In the app (Settings page, if available), look for a backup button or open the browser Console and run:
   ```js
   // Test Firebase connection
   import { firebaseEnabled, setAppDataBackup } from './src/lib/firebase';
   console.log('Firebase enabled:', firebaseEnabled());
   ```

5. Check Firestore in Firebase Console:
   - Go to **Firestore Database** → **Data**
   - You should see a `billease` collection with an `appData` document
   - Click it to view your backed-up data

✅ If you see data in Firestore, Firebase is working!

---

## Step 5: (Optional) Add Authentication

To add login/sign-up later:

1. Go to **Authentication** → **Get started**
2. Enable **Email/Password** provider
3. Click **Save**

We can add login UI in a future update.

---

## Next: Connect App to Firebase Sync

After Firestore is set up, I can add:
- ✅ Auto-upload app data to Firestore when you save
- ✅ Download data from Firestore to restore on another device
- ✅ Settings UI buttons: Upload Backup / Download Backup / Clear Local Data

Would you like me to implement these sync hooks now?
