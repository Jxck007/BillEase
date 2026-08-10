# BillEase Production Engineering Audit

Audit date: 2026-08-10. Baseline HEAD: `165c31bb4b7d5a63e82997cf35f505dfde95065e`.

## Executive conclusion

The reported pending-sync behavior came from application sync orchestration, not a Firebase service deficiency. Firestore transactions fail offline; the app persisted a dirty flag but did not retrigger the transaction on reconnect. A snapshot/transaction callback race could clear pending and then set the UI back to saving. The aggregate local-wins merge could also overwrite another device's different-invoice edit. These defects were reproduced by policy tests and fixed without altering production data or migrating providers.

Keep Firebase now, but normalize the Firestore data model through a separately approved migration. The aggregate document remains a material reliability/scale constraint even after stabilization.

## Confirmed synchronization bugs

### 1. Reconnect did not restart the durable dirty state

- BUG: offline/retry-exhausted writes remained pending after the browser returned online.
- ROOT CAUSE: the online handler updated display metadata only; `useFirestoreSync` depended on state/enabled and neither changed.
- FIX: explicit durable retry trigger on offline-to-online transition and manual Retry; stable outbox operation identity survives reload.
- REGRESSION TEST: lifecycle B/K plus auth/permission classification.

### 2. Acknowledgement callback ordering could restore `saving`

- BUG: matching server snapshot cleared pending, then `onPersisted` ran and set `saving` again.
- ROOT CAUSE: two acknowledgement paths mutated one status without idempotent ordering.
- FIX: one acknowledgement function; both matching authoritative snapshot and resolved transaction validate operation ID/content hash and clear once. A later callback is a no-op.
- REGRESSION TEST: committed-write and older-async-commit tests.

### 3. Aggregate merge overwrote untouched remote entities

- BUG: when A changed invoice A and B changed invoice B, A's stale copy of invoice B overwrote B.
- ROOT CAUSE: `mergeRemoteWithoutLosingLocal` applied every local array entry over remote, with no local-intent set.
- FIX: durable outbox records touched entities and their base hashes. Remote owns untouched entities. Same-entity concurrent edits are blocked and both versions are recovered.
- REGRESSION TEST: lifecycle C, D, L, and M.

### 4. IndexedDB success preceded transaction completion and failures poisoned later saves

- BUG: request `onsuccess` was treated as durable transaction completion; a rejected promise chain prevented subsequent writes.
- ROOT CAUSE: persistence resolved on request events and used a permanently rejectable tail promise.
- FIX: resolve on `IDBTransaction.oncomplete`; ordered queue exposes each failure but continues later saves.
- REGRESSION TEST: lifecycle N.

### 5. Embedded profile images could exceed the aggregate document limit

- BUG: two raw 500 KB image uploads become larger base64 strings inside `appData`, potentially exceeding Firestore's 1 MiB document limit.
- ROOT CAUSE: profile logo/QR used raw `FileReader` data URLs; no aggregate byte guard existed.
- FIX: resize/compress new profile assets and reject aggregate payloads above a conservative 900,000-byte threshold with an actionable error.
- REGRESSION TEST: aggregate size boundary and error classification tests.

### 6. Cache initialization fallback could initialize Firestore twice

- BUG: a persistent-cache initialization exception called `initializeFirestore` again.
- ROOT CAUSE: fallback used the initializer rather than retrieving the existing/default instance.
- FIX: fallback uses `getFirestore(app)`.
- REGRESSION TEST: typecheck/build plus browser local-mode initialization.

## Severity findings

### Critical

- Firestore security rules are absent from the repository. Deployed authorization cannot be audited, tested, or reproduced. No speculative rules were deployed during this task.

### High

- Single `billease/appData` document creates a 1 MiB ceiling, whole-state write amplification, one contention target, and document-level concurrency conflicts.
- Two tabs share the local aggregate checkpoint but have independent React state; simultaneous offline tab edits are not lossless.
- No authenticated isolated Firebase project/emulator configuration was available, so the real backend cross-device acceptance gate remains a manual release test.

### Medium

- `DataContext.tsx` is a 600+ line state/persistence/sync/command component; changes have broad rerender and regression scope.
- A compatible lockfile-only audit fix patched NanoID and DOMPurify without a major upgrade. Eight moderate UUID advisories remain in Firebase Admin's Google Cloud dependency graph. The affected custom-buffer UUID path is not called by BillEase, but the server dependency is reachable; automated remediation incorrectly proposes a breaking Firebase Admin downgrade to v10.3.0, so it was not applied.
- Delivery rate-limit/idempotency documents have timestamps but no repository-defined TTL/retention configuration.
- Customer desktop table requires horizontal scrolling at 1280 px with weak visual affordance.
- Mobile sync information consumes substantial vertical space; wording is now truthful, but the long-pending state should be condensed in a future UX pass.
- Axe found a landmark issue around last-save text and a serious Tamil quick-action contrast issue. The sync bar now has a labelled region and the hint contrast was raised. The final tested Tamil dashboard scan reports zero violations.

### Low / informational

- Missing favicon produces a development 404.
- `mergeRemoteWithoutLosingLocal`, cloud recovery helper, delete-backup helper, and cloud count helper have no production callers. They are removal candidates only after migration/recovery intent is confirmed.
- Legacy `invoiceService` localStorage draft helpers remain alongside IndexedDB drafts; confirm old-client upgrade needs before removal.
- `.env.local` contains ignored legacy Resend variables, but application code has no Resend caller. Remove secrets manually from local/Vercel environments after Gmail verification.
- No GitHub workflow or ESLint ruleset is versioned; `npm run lint` is TypeScript typecheck only.

## Dependency classification

Required runtime/build capabilities: React/React DOM, Router, Firebase client/Admin, date-fns, fflate, Formidable, html2canvas, jsPDF, Lucide, motion/react, Nodemailer, QRCode, Recharts, clsx/tailwind-merge, Tailwind/Vite/React plugin, TypeScript/tsx and Node/React types. Autoprefixer has no repository configuration/reference and is a removal candidate; it was not removed because the styling toolchain should be validated in a dedicated dependency change. `@types/qrcode` and the Vite plugins are build-time packages currently listed as production dependencies; classification cleanup is low urgency.

No dependency was removed and no major version was upgraded. The lockfile now resolves DOMPurify 3.4.13 and NanoID 3.3.18 through compatible transitive updates.

## Performance evidence

Production build baseline:

- CSS: 74.58 KB raw / 13.98 KB gzip.
- React vendor: 233.53 KB / 74.79 KB gzip.
- Firebase vendor: 427.61 KB / 113.71 KB gzip.
- Main application chunk: 277.96 KB / 87.20 KB gzip.
- Reports route: 391.65 KB / 114.14 KB gzip, dominated by charting.
- jsPDF: 384.29 KB / 125.58 KB gzip and html2canvas: 202.38 KB / 48.04 KB gzip, both loaded through export paths.

The aggregate state is serialized for IndexedDB, content hashing, and every Firestore write. Snapshot hydration normalizes every entity and recalculates payment state. All `DataContext` consumers rerender on any app-state change. These are measured/code-path bottlenecks; no speculative memoization rewrite was made. The fictional browser fixture (one customer/invoice/payment) was 3,471 JSON bytes.

## Product and accessibility evidence

Captured flow: dashboard -> add customer -> invoice editor -> invoice preview -> partial payment confirmation -> mobile dashboard -> Tamil dashboard. Screenshots are stored under `output/playwright/billease-audit/` and were visually inspected before acceptance.

Strengths: clear task-first dashboard, name-only customer flow, immediate durable-save feedback, explicit payment review with resulting balance/status, preserved payment history actions, responsive mobile navigation, proper Tamil `lang=ta`, labelled dialogs, focus isolation/restoration, and 44+ px primary targets.

Risks: cloud-unavailable previously used a green synced treatment and always asked why sync was pending; this is corrected. Customer table actions are horizontally discoverable only by scrolling at some desktop widths. The invoice editor is necessarily long and could benefit from section progress/sticky summary validation, but no aesthetic redesign is justified. Email/native-share/print interactions require real device/provider checks.

## Security and data integrity

Server credentials are read only from non-`VITE_` variables. The build/source scan found no committed secret value. Gmail sender/auth are server-owned; HTML is escaped; filenames, MIME signatures, recipient identity, request sizes, auth, admin role, rate limits, and idempotency are validated. APIs return normalized safe errors. The local untracked `.env.local` is ignored by Git.

Existing and added tests cover paise arithmetic, overpayment rejection, payment operation idempotency, reversal preservation, cancelled/quotation reporting exclusions, historical customer snapshots, malformed persistence, stable IDs/hashes, sync lifecycle A-N, Gmail, export, sharing, receipts, Tamil/footer, and baseline accessibility structure.

## Architecture comparison

| Option | Rating | Evidence |
| --- | ---: | --- |
| Firebase current aggregate | 5/10 | Stabilized and low migration risk, but hard size/contention/conflict limits remain |
| Firebase normalized | 9/10 | Keeps Auth/offline/realtime/server stack; entity-level writes/listeners/conflicts fit BillEase |
| Supabase/Postgres + Realtime | 6/10 | Strong SQL/reporting, but Auth/RLS/server migration and no automatic browser offline outbox |
| Supabase + custom offline layer | 7/10 capability, 3/10 migration value now | Can satisfy requirements but recreates the hardest sync layer at high risk |

Official Firestore documentation confirms transactions fail offline, persistent web cache supports multi-tab/offline reads and metadata, documents are limited to 1 MiB, and heavy writes to one document cause contention. Supabase documentation confirms Postgres/Realtime/RLS capabilities but does not remove the need for BillEase-specific offline conflict handling.

## Test-suite quality

The original suite is fast and protects financial/export/delivery regressions, but several UI tests assert source text rather than rendered behavior. Sync coverage previously asserted helper outputs and regexes without executing lifecycle failures. The new lifecycle suite covers requested A-N policy behavior, but a Firebase Emulator integration suite and real browser IndexedDB failure injection are still needed. No CI workflow currently enforces the gates.

## Remaining manual gates

- Authenticated A/B sessions against an isolated Firebase project or Emulator.
- Offline reconnect with an actual Firestore transaction and authoritative metadata event.
- Same/different entity two-device conflicts with recovery export review.
- Two-tab simultaneous offline edits (known unsupported limitation).
- Gmail SMTP controlled send, native Android file sharing, WhatsApp fallback, print/PDF visual checks, and production rules tests.
- Measure production `billease/appData` serialized/Firestore size through an approved authenticated diagnostic.

## Recommendation

Retain Firebase and schedule normalized Firestore migration as a separate, backed-up, dry-run, reversible project. Do not migrate to Supabase based on the resolved client orchestration bugs.
