# 🚨 Troubleshooting & Common Issues

## 🔴 Issues & Solutions

### **Issue 1: App Goes Blank After Clear**

**Problem:** You cleared data, now the app shows nothing

**Solution:**
```javascript
// In browser console (F12):
location.reload();  // Force refresh

// If still blank:
localStorage.clear();
location.reload();
```

**What's happening:** App is loading but data cache is empty. This is normal on first load after clear.

---

### **Issue 2: Data Not Syncing to Firebase**

**Symptoms:** `updatedAt` timestamp not changing in Firestore

**Check 1: Is Firebase Enabled?**
```javascript
// In browser console:
checkFirebaseStatus()  // Shows Firebase config status
```

**Check 2: Environment Variables**
1. Open `.env` file
2. Verify:
   ```env
   VITE_FIREBASE_ENABLED=true    ← Must be TRUE
   VITE_FIREBASE_PROJECT_ID=xxx  ← Must have value
   VITE_FIREBASE_API_KEY=xxx     ← Must have value
   ```
3. If changed, stop dev server and run:
   ```bash
   npm run dev
   ```

**Check 3: Firebase Rules**
1. Go to Firebase Console → Firestore → Security Rules
2. Make sure rules allow write access:
   ```rules
   match /billease/{document=**} {
     allow read, write: if true;  // For development
   }
   ```

**Check 4: Internet Connection**
- Make sure browser is online
- Check browser console for network errors (F12 → Network tab)

---

### **Issue 3: Logo Upload Fails or App Freezes**

**Problem:** "File too large" error or app becomes unresponsive

**Solution:**
1. Use image < 500KB (0.5MB)
2. Compress image before upload:
   - Use online tools: [tinypng.com](https://tinypng.com)
   - Or resize to 1200x600 pixels max

**Check Storage:**
```javascript
// In browser console:
viewAppData()  // Shows logo size in KB
```

---

### **Issue 4: localStorage is Full**

**Symptoms:**
- "QuotaExceededError" in console
- New data not saving
- App becomes slow

**Solution:**
```javascript
// In browser console:
clearLocalData()  // Clears everything

// Or selective clear:
localStorage.removeItem('appData');
location.reload();
```

**Prevention:**
- Keep logos < 500KB
- Don't store large documents (> 1MB)
- Regularly backup and clear old data

---

### **Issue 5: Export/Share Buttons Do Nothing**

**Problem:** PNG export or WhatsApp share not working

**Symptoms:**
- Click export button → nothing happens
- No download dialog appears
- Console shows errors

**Solutions:**

1. **For PNG Export:**
   ```javascript
   // Click export button and check console (F12):
   // Should show: ✅ Image exported successfully
   // If error: Check browser allows downloads
   ```

2. **For WhatsApp Share:**
   - Make sure customer has phone number filled
   - Phone must be 10 digits (India format)
   - Test: Go to Invoice → Edit → Check customer phone

3. **For Native Share (Share button):**
   - Only works on mobile or secure HTTPS
   - Desktop needs browser support (Chrome, Edge, Safari)
   - Check console for share API errors

---

### **Issue 6: Firestore Console Shows Empty Data**

**Problem:** Firebase Console shows no data even after saving in app

**Possible Causes:**

1. **Firebase not enabled in app:**
   ```javascript
   checkFirebaseStatus()  // Should show ✅ Ready for cloud sync
   ```

2. **Collection not created yet:**
   - Make a change in app (add customer)
   - Wait 3 seconds
   - Refresh Firestore console

3. **Wrong Project Selected:**
   - Check Firebase console title (top left)
   - Should match your `.env` `VITE_FIREBASE_PROJECT_ID`

4. **Data in localStorage but not Firestore:**
   ```javascript
   // This is OK - sync might be pending
   // Wait 3 seconds and refresh
   ```

---

### **Issue 7: Can't Delete Data from Firestore**

**Problem:** Delete button doesn't work or permission denied

**Solution:**

1. **Check Firebase Security Rules:**
   - Firebase Console → Firestore → Security Rules tab
   - For development, use permissive rules:
     ```rules
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /billease/{document=**} {
           allow read, write: if true;
         }
       }
     }
     ```

2. **Or use Firebase Console UI:**
   - Click document → Click "Delete" button (trash icon)
   - Confirm deletion

3. **Programmatically from app:**
   - Go to Settings page
   - Find "Delete Cloud Backup" button

---

### **Issue 8: Can't Create Invoice - "Something Went Wrong"**

**Possible Causes:**

1. **No Customer Selected:**
   - Go to Customers page
   - Add at least 1 customer first

2. **Invalid Data:**
   - Check console for error message (F12)
   - Make sure product prices are valid numbers

3. **Firebase Error:**
   ```javascript
   // Check Firebase status:
   checkFirebaseStatus()
   ```

4. **Quota Exceeded:**
   ```javascript
   // Clear data if needed:
   clearLocalData()
   ```

---

### **Issue 9: Print/PDF Layout Broken**

**Problem:** Invoice prints incorrectly or blank

**Solutions:**

1. **Test Print Preview:**
   - Go to Invoice → Click "Print" button
   - Your browser's print preview should show
   - Check if layout looks correct

2. **Browser Print Settings:**
   - In print dialog, make sure:
     - ✅ "Background graphics" is checked
     - ✅ Paper size is A4 (210mm × 297mm)
     - ✅ Margins are set to normal

3. **For PDF Export:**
   - Use "Export as Image" button instead
   - Or use browser "Print to PDF" feature

4. **Test Data Present:**
   - Make sure invoice has:
     - ✅ Customer selected
     - ✅ At least 1 item
     - ✅ Prices filled in

---

### **Issue 10: Changes Not Appearing After Refresh**

**Problem:** Made a change, but after refresh it's gone

**Possible Cause:**
- App didn't save to localStorage

**Solution:**

1. **Check if data saved:**
   ```javascript
   viewAppData()  // Shows what's in storage
   ```

2. **If empty, try again:**
   - Make the change slower (double-check each field)
   - Click Save button explicitly

3. **Check console for errors:**
   - F12 → Console tab
   - Look for red error messages

4. **Force browser to save:**
   - Developer Tools (F12) → Application → localStorage
   - Look for `appData` key
   - Should show your data

---

## 🆘 Emergency: Complete Reset

**If everything is broken:**

```javascript
// In browser console (F12):

// Step 1: Clear all local data
localStorage.clear();
sessionStorage.clear();

// Step 2: Clear all cookies (if needed)
document.cookie.split(";").forEach((c) => {
  document.cookie = c
    .replace(/^ +/, "")
    .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
});

// Step 3: Reload app
location.reload();

// Step 4 (Firebase): Delete Firestore data from console manually
```

After complete reset:
1. App loads with empty data ✅
2. Add business profile in Settings
3. Add a customer
4. Create an invoice
5. Test that it saves

---

## ✅ Verification Checklist

After clearing and setting up fresh:

- [ ] App loads without errors
- [ ] Can add a customer
- [ ] Can add a product
- [ ] Can create an invoice
- [ ] Can see data in localStorage: `viewAppData()`
- [ ] Firebase synced: `checkFirebaseStatus()`
- [ ] Can print invoice (Ctrl+P)
- [ ] Can export as PNG
- [ ] Can share on WhatsApp (with customer phone)
- [ ] Data persists after page refresh

---

## 📊 Performance Checklist

After fresh setup, make sure:

- [ ] App loads in < 2 seconds
- [ ] No console errors (F12 → Console)
- [ ] Can add 100+ invoices without lag
- [ ] Export/Share works within 3 seconds
- [ ] Print preview loads instantly
- [ ] Firestore sync completes in 2-3 seconds

---

## 🔍 Debug Tips

### **Enable Debug Logging:**
```javascript
// Add to browser console:
localStorage.setItem('DEBUG', 'true');
location.reload();

// Now watch console for detailed logs
```

### **Monitor Network Activity:**
- Open F12 → Network tab
- Make a change in app
- Watch for "firestore" requests
- Should show successful POST requests to Firebase

### **Check Firestore Rules:**
```javascript
// In Firebase Console:
// Firestore → Security Rules
// Click "Rules playground" to test permissions
```

### **View Raw API Responses:**
- F12 → Network tab
- Filter: "firestore"
- Click on request
- View "Response" tab to see Firebase data

---

## 📞 When to Contact Support

If you've tried all above and still have issues:

1. **Take a screenshot** of:
   - Browser console errors (F12)
   - Firebase Console showing data
   - The issue description

2. **Provide information:**
   - BillEase version
   - Browser version
   - Steps to reproduce
   - Expected vs actual behavior

3. **Attach logs:**
   ```javascript
   // Export debug info:
   console.log(JSON.stringify({
     data: JSON.parse(localStorage.getItem('appData')),
     env: {
       firebaseEnabled: import.meta.env.VITE_FIREBASE_ENABLED,
       projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID
     }
   }, null, 2));
   ```

---

**Most issues are resolved by clearing data and restarting. Try that first! 🚀**
