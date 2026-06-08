# BillEase - Vercel Deployment Guide

Complete step-by-step guide to deploy BillEase to Vercel with Firebase Firestore auto-sync.

---

## 📋 Prerequisites

- ✅ GitHub account (to host your code)
- ✅ Vercel account (free tier available at https://vercel.com)
- ✅ Firebase project setup (optional, for cloud backup)

---

## 🚀 Step 1: Prepare Your Repository

### 1.1 Create/Push to GitHub

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial BillEase commit"

# Add GitHub remote (replace YOUR_USERNAME and YOUR_REPO)
git remote add origin https://github.com/YOUR_USERNAME/billease.git
git branch -M main
git push -u origin main
```

### 1.2 Create `.gitignore` (if not exists)

Create `.gitignore` in project root:

```
node_modules/
dist/
.env
.env.local
.env.*.local
*.log
.DS_Store
```

### 1.3 Verify `package.json` has correct build script

```json
{
  "scripts": {
    "dev": "vite --port=3000",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

---

## 🔧 Step 2: Set Up Environment Variables

### 2.1 Create `.env.example` (for reference, NOT uploaded)

```env
# Firebase Configuration (optional - for cloud backup)
VITE_FIREBASE_ENABLED=false
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Gemini AI (optional - if using AI features)
GEMINI_API_KEY=your_gemini_key
```

### 2.2 Get Firebase Credentials (Optional)

If you want Firestore auto-sync:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Project Settings** → **Service Accounts**
3. Click **Generate New Private Key**
4. Copy the Firebase config values (NOT the entire JSON)

---

## 📤 Step 3: Deploy to Vercel

### 3.1 Connect GitHub to Vercel

1. Go to https://vercel.com/new
2. Click **"Import Git Repository"**
3. Connect your GitHub account
4. Select your `billease` repository
5. Click **Import**

### 3.2 Configure Project Settings

**Framework Preset:** React  
**Build Command:** `npm run build`  
**Output Directory:** `dist`  
**Install Command:** `npm install`  

### 3.3 Add Environment Variables

In Vercel project settings:

1. Click **Settings** → **Environment Variables**
2. Add each variable:

```
VITE_FIREBASE_ENABLED = false    (start with disabled)
VITE_FIREBASE_API_KEY = (leave empty for now)
VITE_FIREBASE_AUTH_DOMAIN = (leave empty for now)
VITE_FIREBASE_PROJECT_ID = (leave empty for now)
VITE_FIREBASE_STORAGE_BUCKET = (leave empty for now)
VITE_FIREBASE_MESSAGING_SENDER_ID = (leave empty for now)
VITE_FIREBASE_APP_ID = (leave empty for now)
```

3. Click **Deploy**

---

## ✅ Step 4: Verify Deployment

After ~2-3 minutes:

1. Vercel will assign you a URL (e.g., `https://billease.vercel.app`)
2. Click the URL to view your live app
3. Test that invoices, customers, and products work locally

---

## 🔒 Step 5: Enable Firebase (Optional)

If you want **automatic cloud backup to Firestore**:

### 5.1 Update Environment Variables

In Vercel Settings → Environment Variables:

```
VITE_FIREBASE_ENABLED = true
VITE_FIREBASE_API_KEY = pk_xxx...
VITE_FIREBASE_AUTH_DOMAIN = billease-xyz.firebaseapp.com
VITE_FIREBASE_PROJECT_ID = billease-xyz
VITE_FIREBASE_STORAGE_BUCKET = billease-xyz.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID = 123456789
VITE_FIREBASE_APP_ID = 1:123456789:web:abc123xyz
```

### 5.2 Test Firestore Sync

1. Go to your Vercel deployment
2. Add a customer/product/invoice
3. Check [Firebase Console](https://console.firebase.google.com) → Firestore:
   - Collection: `billease`
   - Document: `appData`
   - Should see your data with `updatedAt` timestamp

---

## 📊 Step 6: Custom Domain (Optional)

1. Vercel dashboard → **Settings** → **Domains**
2. Click **Add Domain**
3. Enter your custom domain (e.g., `billease.yourcompany.com`)
4. Follow DNS configuration steps from your domain provider

---

## 🛡️ Step 7: Security Best Practices

### ✅ Do:
- Keep `.env` files local only
- Never commit secrets to GitHub
- Rotate Firebase keys periodically
- Use Vercel's built-in environment variable encryption

### ❌ Don't:
- Share Firebase credentials publicly
- Commit `.env` to GitHub
- Use production keys in development

---

## 🔄 Step 8: Continuous Deployment

After your first deployment, **every push to `main` branch** will auto-deploy:

```bash
# Make changes locally
git add .
git commit -m "Fix invoice HSN display"
git push origin main

# Vercel automatically rebuilds and deploys! 🎉
```

Monitor deployments:
- Vercel dashboard → **Deployments** tab
- Shows build logs, status, and performance

---

## 🆘 Troubleshooting

### Build fails with "Cannot find module"
```bash
npm install
npm run build
```

### Environment variables not working
1. Verify spelling matches `.env.example`
2. Redeploy after adding variables
3. Check Vercel logs: **Deployments** → **Build Logs**

### Firestore sync not working
- Verify `VITE_FIREBASE_ENABLED=true` in Vercel
- Check Firebase project has Firestore enabled
- Check browser console for errors (F12 → Console)

### Custom domain DNS issues
- Vercel provides DNS configuration
- Wait 24-48 hours for DNS propagation
- Test with: `nslookup yourdomain.com`

---

## 📱 Mobile Access

Once deployed to Vercel, access on any device:

```
iPhone: https://billease.vercel.app
Android: https://billease.vercel.app
Desktop: https://billease.vercel.app
```

All data syncs locally to browser, Firestore (optional).

---

## 🎉 You're Live!

Your BillEase app is now on the internet! 

**Vercel URL:** `https://billease.vercel.app` (or your custom domain)

### Next Steps:
- ✅ Share the URL with your team
- ✅ Enable Firebase if needed (Step 5)
- ✅ Set up custom domain (Step 6)
- ✅ Configure backups in app settings

---

## 📞 Quick Reference

| Task | Action |
|------|--------|
| View deployed app | Click Vercel project URL |
| Redeploy | Push to `main` branch |
| Update env vars | Vercel Settings → Environment Variables → Redeploy |
| Check logs | Vercel Deployments → Build Logs |
| Rollback | Vercel Deployments → Select previous → Promote |
| Add domain | Vercel Settings → Domains |

---

**Questions?** Check Vercel docs: https://vercel.com/docs
