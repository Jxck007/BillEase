# 📋 Quick Reference: Clear DB & Start Fresh

## 🚀 START HERE (30 seconds)

### **Clear Local Data & Reload**

**Option A: In-App (Easiest)**
1. Go to Settings page
2. Find "Clear Local Data" button
3. Click → App resets

**Option B: Browser Console**
```javascript
// Press F12, go to Console tab, paste:
localStorage.removeItem('appData');
localStorage.removeItem('billease.invoiceDraft');
location.reload();
```

---

## 🔥 VIEW DATA IN FIRESTORE (3 steps)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click **Firestore Database** → billease → appData
4. **Data appears automatically** ✅

---

## ✅ VERIFICATION STEPS

Run these checks:

```javascript
// In browser console (F12):

// 1. View all data
viewAppData()

// 2. Check Firebase config
checkFirebaseStatus()

// 3. See data stats
showStats()

// 4. Backup data
exportDataAsJson()

// 5. Restore data
importDataFromJson()
```

---

## 📍 DATA STRUCTURE IN FIRESTORE

```
billease/
└── appData
    ├── customers: [...]
    ├── invoices: [...]
    ├── products: [...]
    ├── payments: [...]
    ├── deliveryNotes: [...]
    ├── expenses: [...]
    ├── settings: {...}
    └── updatedAt: "2026-05-10T..."
```

---

## 🔄 VERIFY SYNC IS WORKING

1. Make change in app (add customer)
2. Open Firestore → billease → appData
3. Check **updatedAt** timestamp
4. Refresh Firestore page
5. **Timestamp should update** ✅

**If not updating:**
```javascript
checkFirebaseStatus()  // Check why
```

---

## 🗑️ COMPLETE RESET (Nuclear Option)

```javascript
// In console:
localStorage.clear();
sessionStorage.clear();
location.reload();

// Then delete Firestore data:
// Firebase Console → firebasestore → billease → appData → Delete
```

---

## 📊 TROUBLESHOOTING QUICK LINKS

| Issue | Solution |
|-------|----------|
| App blank | `location.reload()` |
| No Firebase sync | Run `checkFirebaseStatus()` |
| Firestore empty | Wait 3s, refresh page |
| Data lost | Use `exportDataAsJson()` backup |
| Logo too large | Use image < 500KB |
| Export blank | Wait 2s before exporting |
| Full storage | Run `clearLocalData()` |

---

## 🎯 COMMON COMMANDS

```javascript
// Load utilities (runs automatically)
// Type: help()

// Clear everything
clearLocalData()

// View current state
viewAppData()
showStats()

// Firebase status
checkFirebaseStatus()

// Backup/Restore
exportDataAsJson()
importDataFromJson()

// Test sync
testSync()
```

---

## 📁 DOCUMENTATION FILES

| File | Purpose |
|------|---------|
| [SETUP_GUIDE.md](SETUP_GUIDE.md) | Complete setup & clear instructions |
| [FIRESTORE_GUIDE.md](FIRESTORE_GUIDE.md) | How to view data in Firebase |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Fix common issues |
| [CONSOLE_UTILITIES.js](CONSOLE_UTILITIES.js) | Helper functions for console |

---

## ✅ PRE-LAUNCH CHECKLIST

- [x] Code clean (TypeScript: 0 errors)
- [x] Build successful
- [x] No warnings
- [ ] Firebase configured in `.env`
- [ ] Firestore collection exists
- [ ] Can add customers & invoices
- [ ] Data syncs to Firebase
- [ ] PNG export works
- [ ] Share buttons work
- [ ] Print to A4 works

---

## 🎯 NEXT STEPS

1. **Clear data** (see above)
2. **Enable Firebase** (set `.env` variables)
3. **Add business profile** (Settings page)
4. **Start using** (add customers, products, invoices)
5. **Monitor Firestore** (watch data sync in real-time)

---

**Ready? Start fresh now! 🚀**

Questions? Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
