# 🔥 Firestore Data Viewing Guide

## Quick Start: View Your BillEase Data in Firestore

### **Step 1: Go to Firebase Console**
```
https://console.firebase.google.com/
```

### **Step 2: Select Your Project**
- Click on your BillEase project (e.g., "billease-prod" or your project name)

### **Step 3: Navigate to Firestore**
```
Left Menu → Firestore Database
```

You should see the database interface with a path breadcrumb.

---

## 📍 Data Path Structure

```
Collections (in Firestore):
└── billease                          ← Top-level collection
    └── appData                       ← Single document containing all app data
        └── (Document fields below)
```

### **Inside the `appData` Document:**

```
appData (Document)
├── profile: { businessName, address, phone, email, gstin, logo, ... }
├── customers: [ { id, name, phone, email, address, gstin, ... }, ... ]
├── invoices: [ { id, number, date, customerId, items, total, ... }, ... ]
├── products: [ { id, name, hsn, price, taxRate, ... }, ... ]
├── payments: [ { id, invoiceId, amount, date, mode, ... }, ... ]
├── deliveryNotes: [ { id, number, customerId, items, total, ... }, ... ]
├── expenses: [ { id, category, amount, date, description, ... }, ... ]
├── settings: { language, gstMode, stateCode, ... }
├── auditLogs: [ { timestamp, action, userId, changes, ... }, ... ]
└── updatedAt: Timestamp (ISO format)
```

---

## 👀 How to View Data

### **Method 1: Simple View (Recommended)**

1. Open Firestore Database
2. In left sidebar, click **Collections**
3. Click **billease** collection
4. Click **appData** document
5. You'll see all fields in a scrollable panel:

```
Field Name          | Type    | Value
────────────────────┼─────────┼─────────────────────────
profile             | Map     | { businessName: "...", ... }
customers           | Array   | [ ... ]
invoices            | Array   | [ ... ]
products            | Array   | [ ... ]
payments            | Array   | [ ... ]
deliveryNotes       | Array   | [ ... ]
updatedAt           | String  | "2026-05-10T14:30:45.123Z"
```

### **Method 2: Detailed View (Inspect Arrays)**

To see individual invoices:

1. In appData, scroll down to **invoices** field
2. Click the **`invoices`** row → Expands to show array items
3. Each invoice shows:
   ```
   [0]  { id: "INV001", number: "INV-001", date: "2026-05-10", ... }
   [1]  { id: "INV002", number: "INV-002", date: "2026-05-11", ... }
   ...
   ```

4. Click on an invoice to expand and see all fields:
   ```
   id .......................... "INV001"
   number ...................... "INV-001"
   date ........................ "2026-05-10"
   customerId .................. "CUST123"
   subtotal .................... 10000
   taxTotal .................... 1800
   total ....................... 11800
   items:
     [0] { id: "1", productId: "PROD001", quantity: 2, price: 500, ... }
     [1] { id: "2", productId: "PROD002", quantity: 1, price: 2000, ... }
   amountPaid .................. 5000
   status ...................... "draft"
   createdAt ................... "2026-05-10T10:15:30.000Z"
   ```

---

## 🔍 Finding Specific Data

### **Search an Invoice by Number:**

1. Open `appData` document
2. Find **invoices** array
3. Look for matching `number` field
4. Example: `"INV-2026-00001"`

### **Find Customer:**

1. Open `appData` document
2. Find **customers** array
3. Look for customer by name or phone
4. Copy the customer's **`id`** for use in invoices

### **Check Sync Status:**

1. Open `appData` document
2. Look at **`updatedAt`** field (last line, usually)
3. This shows when app last synced
4. Make a change in BillEase app
5. Wait 2-3 seconds
6. Refresh Firestore page
7. **`updatedAt`** should update → ✅ Sync working!

---

## 🔄 Real-time Sync Verification

### **Test Cloud Sync:**

1. **Start here:**
   ```
   Open BillEase app in one browser tab
   Open Firebase Console (this page) in another tab
   ```

2. **Make a change in app:**
   - Go to **Customers** → Click **+** → Add a customer
   - Fill name, phone, email
   - Click **Save**

3. **Watch Firestore (this tab):**
   - Click **Firestore Database** (refresh if needed)
   - Go to `billease` → `appData`
   - Scroll down to **customers** array
   - **You should see the new customer there!** ✅

4. **Check updatedAt:**
   - Look at the **`updatedAt`** field at the bottom
   - It should show current time
   - If timestamp updated → ✅ Sync is working!

---

## 📊 Understanding the Data Types

### **String Fields**
```javascript
"invoiceNumber": "INV-2026-00001"
"customerName": "Acme Corp"
```

### **Numeric Fields**
```javascript
"total": 11800        // Total amount in rupees
"taxRate": 18         // Tax percentage (e.g., 18%)
"quantity": 5         // Item quantity
```

### **Array Fields (Multiple items)**
```javascript
"customers": [
  { id: "C1", name: "Customer A", ... },
  { id: "C2", name: "Customer B", ... }
]
"items": [
  { id: "1", productId: "P1", qty: 2, price: 500 },
  { id: "2", productId: "P2", qty: 1, price: 2000 }
]
```

### **Map/Object Fields (Nested data)**
```javascript
"profile": {
  "businessName": "My Company",
  "address": "123 Street",
  "phone": "9876543210"
}
```

### **Timestamp Fields**
```javascript
"createdAt": "2026-05-10T10:30:45.000Z"  // ISO format
"updatedAt": "2026-05-10T14:50:20.000Z"
```

---

## 🛠️ Common Tasks in Firestore Console

### **Task 1: Delete a Specific Invoice**

1. Open `appData` document
2. Find **invoices** array
3. Click the invoice row you want to delete
4. Expand it, then click **Delete** (trash icon)
5. Click **Update Document**
6. Check BillEase app → Invoice should be gone ✅

### **Task 2: Edit Customer Data**

1. Open `appData` document
2. Find **customers** array
3. Click customer row → Expand
4. Click the field you want to edit (e.g., phone)
5. Change value
6. Click **Update Document**
7. Check BillEase app → Data updated ✅

### **Task 3: Clear All Data (Manual)**

1. Open `appData` document
2. Click **Edit Document**
3. For each array field (customers, invoices, etc.):
   - Click the **`[]`** (empty array icon)
   - Delete the current content
4. Click **Update Document**
5. Reload BillEase app
6. App will show empty data ✅

### **Task 4: Export Data as JSON**

1. Click **`appData`** document
2. Click the **`{...}`** button (top right) or scroll to bottom
3. Copy all visible text
4. Paste into a text editor
5. Save as `backup.json`

---

## ⚠️ Important Notes

### **Firestore Pricing**
- ✅ **Free tier**: 50,000 reads/day, 20,000 writes/day
- 💰 **Charges**: After free tier, ~$0.06 per 100,000 reads
- 📝 **Tip**: BillEase only writes on app state changes (2-sec debounce), so free tier should be sufficient

### **Data Limits**
- 📄 **Max document size**: 1MB per document
- 📊 **Max array size**: Unlimited items, but total document must be < 1MB
- ⏱️ **Sync delay**: 2-3 seconds (debounced)

### **Backup Strategy**
```
Local (localStorage)           → Firestore (Cloud)
├─ Real-time                   ├─ 2-3 sec delay
├─ 5-10MB limit                ├─ Unlimited storage
├─ Browser cache               ├─ Accessible anywhere
└─ Lost on cache clear         └─ Persistent backup
```

---

## ✅ Checklist: Verify Firestore Setup

- [ ] Firebase project created
- [ ] `.env` file has `VITE_FIREBASE_ENABLED=true`
- [ ] All Firebase credentials in `.env`
- [ ] Can see `billease` collection in Firestore Console
- [ ] Can see `appData` document inside
- [ ] Made a change in BillEase app
- [ ] `updatedAt` timestamp changed in Firestore → ✅ Sync working!
- [ ] Can see customers, invoices, products in Firestore
- [ ] Data structure matches expected fields

---

## 🆘 Troubleshooting

### **Problem: "No billease collection found"**
→ Make a change in BillEase app first. The collection auto-creates on first sync.

### **Problem: "appData document is empty"**
→ Wait 3 seconds, then refresh Firestore page. Sync has 2-second debounce.

### **Problem: "updatedAt doesn't change"**
→ Make sure `VITE_FIREBASE_ENABLED=true` in `.env`. Restart dev server.

### **Problem: "Can't edit/delete in Firestore"**
→ Check Firebase rules. Default rules allow authenticated users. Check Security Rules tab.

### **Problem: "Data disappeared from Firestore"**
→ Check Storage → You may have accidentally deleted the document. Check Firebase audit logs.

---

## 📖 Additional Resources

- [Firebase Firestore Docs](https://firebase.google.com/docs/firestore)
- [Firestore Data Model](https://firebase.google.com/docs/firestore/data-model)
- [Query and Filter Data](https://firebase.google.com/docs/firestore/query-data/queries)
- [Real-time Updates](https://firebase.google.com/docs/firestore/query-data/listen)

---

**You're all set! 🎉 Your BillEase data is now syncing to Firestore and ready to view anytime.**
