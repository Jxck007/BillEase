# BillEase Architecture

## Runtime map

```text
src/main.tsx
  -> AppErrorBoundary
  -> AuthProvider (Firebase Auth + admins/{uid})
  -> LanguageProvider (localStorage + html lang)
  -> DataProvider (application state, local persistence, cloud sync)
  -> HelpProvider / ToastProvider
  -> BrowserRouter / lazy routes / AppLayout

Editor routes
  -> component form state
  -> useAutosaveDraft
  -> IndexedDB draft record
  -> DataContext mutation on Save and Finish

DataContext mutation
  -> React state (immediate visibility)
  -> IndexedDB app-state + durable pendingSync outbox
  -> Firestore transaction on billease/appData
  -> backend commit acknowledgement and snapshot listener
  -> React state + IndexedDB clean checkpoint
```

The application is a Vite/React 19 single-page app. Routes are lazy-loaded in `src/App.tsx`. `DataContext` is the sole application-state provider and currently contains mutation commands, hydration, validation, local persistence, remote listening, conflict handling, and sync presentation state. Errors are isolated globally and around critical editor/preview routes.

## Persistence inventory

| Store | Contents | Current role |
| --- | --- | --- |
| React `DataContext` | Hydrated `AppState` | Current working view |
| IndexedDB `billease-local/records/app-state` | Whole app state, revisions, dirty flag, durable outbox | Durable local source while a write is unacknowledged |
| IndexedDB draft keys | Invoice, quotation, and delivery-note editor drafts | Editor crash/reload recovery; never authoritative business records |
| IndexedDB recovery keys | Bounded pre-delete/payment/conflict snapshots | Local recovery evidence |
| Firestore client cache | Cached `billease/appData` reads and SDK state | Read cache and multi-tab SDK cache; not the transaction outbox |
| Firestore `billease/appData` | Aggregate remote application envelope | Acknowledged remote checkpoint and cross-device distribution |
| Firestore `billeaseAssets/{signature|seal}` | Signature/seal data URLs and removal/default flags | Separate visual-asset records |
| `localStorage` | Language, postal lookup cache, legacy invoice draft | Preferences/optional cache/legacy compatibility |
| `sessionStorage` | Per-tab device ID, report filter draft, chunk reload guard | Ephemeral tab state |

## Data ownership

| Object | Authoritative owner |
| --- | --- |
| Customer | Local durable app state until acknowledgement; then matching Firestore revision is the remote checkpoint |
| Invoice | Same as customer; invoice includes a historical customer snapshot |
| Quotation | Same invoice array with `type: estimate`; same sync ownership |
| Delivery note | Local durable app state until acknowledgement; then Firestore checkpoint |
| Payment/reversal | Append-only stable-ID entries locally and inside the related invoice; acknowledged aggregate is remote checkpoint |
| Company settings/profile | Local durable app state until acknowledgement; then Firestore checkpoint |
| Editor draft | IndexedDB draft record only; it is not cloud data or a completed business record |
| Pending synchronization operation | IndexedDB `pendingSync`; Firestore cache does not own transaction retry state |
| Signature/seal | `billeaseAssets` Firestore documents, with supplied public defaults as fallback |

React state, IndexedDB, Firestore cache, and Firestore backend previously appeared to own the same status. The corrected contract is: React is the working view; IndexedDB is durable local truth while dirty; the backend transaction is the acknowledgement authority; snapshots distribute remote revisions.

## Server architecture

Vercel functions authenticate Firebase ID tokens, then verify `admins/{uid}` using Firebase Admin. The email endpoint validates the selected document against `billease/appData`, validates recipient and attachment metadata, applies per-admin rate limiting and idempotency, and sends through server-only Gmail SMTP. Postal lookup and sanitized error reporting are also admin-authenticated. PDF/PNG/ZIP generation and native sharing run in the browser; WhatsApp is an explicit `wa.me` handoff and never claims file delivery.

## Known architectural boundaries

- This is a single-company aggregate model; there is no `companyId` tenancy boundary in the client data path.
- Firestore rules are not versioned in this repository. Deployment cannot be independently reproduced or security-reviewed until rules are added.
- The server email trust lookup depends on the aggregate path and must be updated during any future normalization.
- `DataContext` is a 600+ line orchestration component and is the main maintainability hotspot. Extraction should follow entity normalization, not precede it without integration tests.
