# 🚀 BillEase Vercel Deployment Checklist

Quick checklist to deploy BillEase to Vercel in 10 minutes.

---

## ✅ Pre-Deployment (5 min)

- [ ] **Commit all changes to GitHub**
  ```bash
  git add .
  git commit -m "Final updates before Vercel deployment"
  git push origin main
  ```

- [ ] **Test build locally**
  ```bash
  npm run build
  npm run preview
  ```

- [ ] **Verify package.json scripts**
  ```json
  "build": "vite build",
  "dev": "vite"
  ```

---

## 🔗 Vercel Setup (5 min)

### Step 1: Go to Vercel
- [ ] Open https://vercel.com/new
- [ ] Click **"Import Git Repository"**
- [ ] **Authorize GitHub** (if not already done)
- [ ] Select **billease** repository

### Step 2: Configure Project
- [ ] **Framework:** React (should auto-detect)
- [ ] **Build Command:** `npm run build`
- [ ] **Output Directory:** `dist`
- [ ] **Node version:** 18.x or higher

### Step 3: Environment Variables (Click "Environment Variables")
- [ ] Add these (leave empty for now):
  ```
  VITE_FIREBASE_ENABLED = false
  ```

### Step 4: Deploy
- [ ] Click **"Deploy"**
- [ ] Wait 2-3 minutes for build to complete
- [ ] ✅ Your app is LIVE! 🎉

---

## 🔍 After Deployment

- [ ] Click the Vercel-assigned URL (e.g., `billease-xyz.vercel.app`)
- [ ] Test invoice creation
- [ ] Test customer management
- [ ] Verify no console errors (F12 → Console)

---

## 🔐 Enable Firebase (Optional)

If you want cloud backup:

### Get Firebase Credentials
- [ ] Open [Firebase Console](https://console.firebase.google.com)
- [ ] Create new project or use existing
- [ ] Go **Project Settings** → **Service Accounts**
- [ ] Click **Generate New Private Key**
- [ ] Copy these values:
  - `apiKey`
  - `authDomain`
  - `projectId`
  - `storageBucket`
  - `messagingSenderId`
  - `appId`

### Update Vercel Variables
- [ ] In Vercel: **Settings** → **Environment Variables**
- [ ] Update:
  ```
  VITE_FIREBASE_ENABLED = true
  VITE_FIREBASE_API_KEY = (your_key)
  VITE_FIREBASE_AUTH_DOMAIN = (your_auth_domain)
  VITE_FIREBASE_PROJECT_ID = (your_project_id)
  VITE_FIREBASE_STORAGE_BUCKET = (your_bucket)
  VITE_FIREBASE_MESSAGING_SENDER_ID = (your_sender_id)
  VITE_FIREBASE_APP_ID = (your_app_id)
  ```

- [ ] **Redeploy:** Go to **Deployments** → **Redeploy** (select latest)

### Test Firestore Sync
- [ ] Add a new invoice on live site
- [ ] Check [Firebase Console](https://console.firebase.google.com)
- [ ] Navigate to **Firestore** → Collection `billease` → Document `appData`
- [ ] Should see your data with `updatedAt` timestamp

---

## 🌐 Custom Domain (Optional)

- [ ] In Vercel: **Settings** → **Domains**
- [ ] Click **Add Domain**
- [ ] Enter your domain (e.g., `invoices.yourcompany.com`)
- [ ] Configure DNS with your domain provider
- [ ] Wait 24-48 hours for DNS to propagate

---

## 🔄 Continuous Updates

Now that you're live, use this workflow:

```bash
# Make changes locally
nano src/pages/Invoices.tsx

# Test locally
npm run dev

# Commit and push (auto-deploys!)
git add .
git commit -m "Fix invoice display"
git push origin main

# Watch deployment in Vercel dashboard
# (should complete in ~2 min)
```

---

## 🆘 If Something Goes Wrong

### Build Failed?
1. Click **Deployments** in Vercel
2. Click the failed deployment
3. Scroll to **Build Logs**
4. Look for error message
5. Fix locally and push again

### App shows 404?
1. Make sure build directory is `dist`
2. Verify `vite.config.ts` exists
3. Check **Vercel Settings** → **Build & Deployment**

### Environment variables not working?
1. Verify variable names match exactly
2. Redeploy after adding variables
3. Check that values don't have extra spaces

### Firestore not syncing?
1. Verify `VITE_FIREBASE_ENABLED=true`
2. Check Firebase project has Firestore enabled
3. Look at browser console (F12 → Console tab)

---

## 📊 Monitor Your Deployment

**Vercel Dashboard:**
- Deployments → See all builds (green = success)
- Settings → Configure domains, env vars, build settings
- Analytics → View traffic, response times

**To redeploy latest:**
```
Deployments → Select any deployment → "Redeploy"
```

---

## ✨ Success Indicators

✅ You're deployed when:
1. Vercel shows "Ready" next to latest deployment
2. Your URL is accessible in browser
3. Invoices can be created/viewed
4. No errors in browser console
5. (Optional) Firestore shows `appData` with recent timestamp

---

## 🎉 You're Done!

Your BillEase app is now live and accessible 24/7!

**Share your URL:** `https://your-vercel-url.vercel.app`

---

**Next Actions:**
- [ ] Share deployment URL with team
- [ ] Add custom domain (optional)
- [ ] Enable Firebase for cloud backup (optional)
- [ ] Set up CI/CD notifications (optional)

**Questions?** See `VERCEL_DEPLOYMENT.md` for detailed guide.
