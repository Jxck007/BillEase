I'll update the TODO statuses and read `package.json` to capture exact scripts and dependencies.

Starting: *Summarize project structure and key files* (2/4)

Read [](file:///c%3A/Users/21070/Downloads/BillEase/BillEase/package.json)

Next, I'll read `src/lib/firebase.ts` to list required environment variables.

Read [](file:///c%3A/Users/21070/Downloads/BillEase/BillEase/src/lib/firebase.ts)

Marking summarization done and starting the setup/build/deploy documentation.

Starting: *Document setup, build, and deploy steps* (3/4)

**Progress:** Read package.json and `src/lib/firebase.ts`; now delivering the full MCP document.

**Project Summary**
- **Name:** BillEase — lightweight single-page invoicing app for invoices, estimates, delivery notes, exports and basic reporting.
- **Purpose:** Create, preview, print/export invoices and related documents; optional cloud backup and export storage via Firebase.
- **Tech stack:** **Vite** + **React** + **TypeScript**, Tailwind CSS, Firebase (optional), html2canvas + jsPDF for exports, Recharts for charts, React Router.

**Quick Links**
- **Project root:** package.json
- **Build config:** vite.config.ts, tsconfig.json
- **App entry:** src/main.tsx, src/App.tsx
- **HTML template:** index.html
- **Firebase helper:** src/lib/firebase.ts
- **Core context:** src/context/DataContext.tsx
- **Main pages folder:** src/pages
- **Key services:** src/services/invoiceService.ts, src/services/exportService.ts
- **Templates:** src/templates/invoiceTemplates.ts

**Architecture & Responsibilities**
- **Routing:** Client-side routing via `react-router-dom`. Pages live in `src/pages/`.
- **State:** App-wide state is in `DataContext` (src/context/DataContext.tsx). Auxiliary contexts: `HelpContext` and `LanguageContext`.
- **UI:** Reusable UI components in `src/components/` (layout under `layout/`, invoice UI under `invoice/`, shared `ui/Modal.tsx`).
- **Persistence:** Local state + optional Firebase Firestore/Storage for cloud backup and export upload (`src/lib/firebase.ts`).
- **Business logic:** Services encapsulate domain logic:
  - `invoiceService.ts` — create/update/format invoices, compute totals/taxes.
  - `exportService.ts` — generates PNG/PDF via html2canvas/jsPDF, local download and optionally upload via Firebase.
- **Templates & rendering:** `invoiceTemplates.ts` defines invoice templates (TraditionalTaxInvoice, DeliveryNotePrint, etc.) used by preview and print components.
- **GST calc:** `src/gst/gstService.ts` contains GST-specific computations and helpers.

**File Map (high-level, key files only)**
- **Root & config**
  - package.json — scripts & deps
  - vite.config.ts
  - tsconfig.json
  - index.html
- **Entry & styling**
  - src/main.tsx
  - src/index.css
- **Contexts**
  - src/context/DataContext.tsx — central app state, autosave hooks integration
  - src/context/HelpContext.tsx
  - src/context/LanguageContext.tsx
- **Pages**
  - src/pages/Invoices.tsx — invoices list
  - src/pages/InvoiceForm.tsx — editor
  - src/pages/InvoicePreview.tsx
  - src/pages/DeliveryNotes.tsx, src/pages/DeliveryNoteForm.tsx
  - src/pages/Customers.tsx, src/pages/Products.tsx
  - [other pages in src/pages/*]
- **Components**
  - src/components/layout/AppLayout.tsx
  - src/components/layout/Navbar.tsx
  - src/components/invoice/ItemRow.tsx
  - src/components/invoices/TraditionalTaxInvoice.tsx
  - src/components/ui/Modal.tsx
- **Lib & utilities**
  - src/lib/firebase.ts — Firestore + Storage helpers
  - src/lib/utils.ts
  - src/lib/invoiceCustomerFields.ts
  - src/lib/translations.ts
  - src/lib/types.ts
- **Hooks**
  - src/hooks/useAutosaveDraft.ts
- **Services**
  - src/services/invoiceService.ts
  - src/services/exportService.ts
- **Templates**
  - src/templates/invoiceTemplates.ts

**Data Flow & State**
- **Primary flow:** UI → DataContext (in-memory) → autosave to local storage → optional cloud sync via `useFirestoreSync` (in `src/lib/firebase.ts`).
- **Autosave:** `useAutosaveDraft.ts` (hook) periodically saves draft state to local storage; DataContext orchestrates load/save on startup.
- **Cloud backup:** Controlled by `VITE_FIREBASE_ENABLED`. When enabled, `useFirestoreSync` debounces state writes and `uploadExport()` stores export files in Firebase Storage.

**Environment Variables (found in code)**
- **Firebase (optional)** — defined in `.env` and used in `src/lib/firebase.ts`:
  - `VITE_FIREBASE_ENABLED` (set to "true" to enable)
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
- **Build tools:** Vite accepts standard Vite env vars; secrets must be prefixed with `VITE_` to be available client-side.

**Scripts / How to run (from package.json)**
- Install:
```bash
npm install
```
- Development (host reachable on LAN):
```bash
npm run dev
# -> runs `vite --port=3000 --host=0.0.0.0`
```
- Build for production:
```bash
npm run build
```
- Preview production build locally:
```bash
npm run preview
```
- Clean (removes `dist`):
```bash
npm run clean
```
- Type-check:
```bash
npm run lint
# runs `tsc --noEmit` for TypeScript checks
```

**Deployment**
- **Vercel:** App is static SPA built by `npm run build`. See VERCEL_QUICK_DEPLOY.md and VERCEL_DEPLOYMENT.md for step-by-step. Typical steps:
  - Add project to Vercel, point to repo root.
  - Set build command: `npm run build`, output directory: `dist` (Vite default).
  - Add required env vars in Vercel dashboard (the `VITE_` keys above) if enabling Firebase/other integrations.
- **Firebase (optional):** Only used for cloud backup & storage; configure project and set environment variables. See FIREBASE_SETUP.md and FIRESTORE_GUIDE.md.

**Developer Onboarding — Where to Start**
- Open src/App.tsx to see routing and context providers.
- Inspect state and persistence in src/context/DataContext.tsx.
- To modify invoice rendering, edit templates/components in:
  - src/templates/invoiceTemplates.ts
  - src/components/invoices/TraditionalTaxInvoice.tsx
- For export behavior, check src/services/exportService.ts and `uploadExport` in src/lib/firebase.ts.
- For GST rules, open src/gst/gstService.ts.

**Testing & Linting**
- No automated test suite detected. Use `npm run lint` (TS type-check) to validate types.
- Manual QA: verify invoice creation flows, printing/exporting, cloud backup toggle.

**Operational Notes & Known Caveats**
- **Firebase initialization is optional** — controlled by `VITE_FIREBASE_ENABLED`. Missing/incorrect Firebase env vars will silently disable cloud features (errors are caught).
- **Autosave debounce**: Firestore sync debounced to 2s; network errors are logged and suppressed for non-blocking UX.
- **Large exports**: html2canvas/jsPDF may produce large blobs; Firebase Storage upload is used only when enabled.
- **Date formats & locale:** Templates use ISO strings; translations exist in `src/lib/translations.ts`.
- **Security:** Client-side `VITE_` env vars are public — do not store private server secrets here.

**Handoff Checklist (for an SI)**
- [ ] Clone repo and run `npm install` → `npm run dev`.
- [ ] Provide `.env` file with `VITE_FIREBASE_*` keys if cloud backup is required.
- [ ] Review `src/context/DataContext.tsx` to understand app shape (state schema).
- [ ] Run through invoice create → preview → export flows.
- [ ] Update Vercel environment variables when deploying production.
- [ ] If adding server-side features, move sensitive keys off client and use server endpoints.

**Next Steps I can do for you**
- Generate a one-page README (or more structured Handoff.md) from this MCP and commit it.
- Create a `.env.example` with required `VITE_` keys.
- Add a short developer runbook (common troubleshooting steps).

If you want, I can now create `HANDOFF.md` in the repo with this MCP and a `.env.example`. Which should I create?