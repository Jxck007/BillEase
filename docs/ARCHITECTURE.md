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
  -> IndexedDB app-state + durable per-operation outbox
  -> Firestore atomic batch for only changed entity documents
  -> backend commit acknowledgement + entity listeners
  -> React state + IndexedDB clean checkpoint
```

The application is a Vite/React 19 single-page app. Routes are lazy-loaded in `src/App.tsx`. `DataContext` is the sole application-state provider and currently contains mutation commands, hydration, validation, local persistence, remote listening, conflict handling, and sync presentation state. Errors are isolated globally and around critical editor/preview routes.

## Persistence inventory

| Store | Contents | Current role |
| --- | --- | --- |
| React `DataContext` | Hydrated `AppState` | Current working view |
| IndexedDB `billease-local/records/app-state` | Whole app state, revisions, dirty flag, `pendingOperations` outbox | Durable local source while one or more entity writes are unacknowledged |
| IndexedDB draft keys | Invoice, quotation, and delivery-note editor drafts | Editor crash/reload recovery; never authoritative business records |
| IndexedDB recovery keys | Bounded pre-delete/payment/conflict snapshots | Local recovery evidence |
| Firestore client cache | Cached normalized reads and queued SDK batches | Native cache; IndexedDB remains the application outbox |
| Firestore `companies/kimera-vel-tech/**` | Normalized remote entity documents | Remote checkpoint and cross-device distribution after cutover |
| Firestore `billease/appData` | Legacy aggregate retained during observation | Compatibility/rollback source; never deleted by migration tooling |
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
| Pending synchronization operation | IndexedDB `pendingOperations`; legacy `pendingSync` is converted conservatively |
| Signature/seal | `billeaseAssets` Firestore documents, with supplied public defaults as fallback |

React state, IndexedDB, Firestore cache, and Firestore backend previously appeared to own the same status. The corrected contract is: React is the working view; IndexedDB is durable local truth while dirty; the backend transaction is the acknowledgement authority; snapshots distribute remote revisions.

## Server architecture

Vercel functions authenticate Firebase ID tokens, then verify `admins/{uid}` using Firebase Admin. The email endpoint validates normalized entity documents first and falls back to `billease/appData` during compatibility. The remaining delivery, PDF, sharing, and Gmail behavior is unchanged.

## Known architectural boundaries

- The current deployment is single-company. `VITE_BILLEASE_COMPANY_ID` defaults to `kimera-vel-tech`; rules also permit legacy admin documents without `companyId` only for that company.
- Firestore rules and emulator configuration are versioned in this repository. Deploy rules separately from data backfill and only after emulator tests pass.
- Data mode is gated by `VITE_FIRESTORE_DATA_MODE`; default `aggregate` prevents an accidental cutover.
- `DataContext` is a 600+ line orchestration component and is the main maintainability hotspot. Extraction should follow entity normalization, not precede it without integration tests.
