# Data Model

## Current Firestore envelope

```text
billease/appData
  data: AppState
  revision: number
  updatedAt: server timestamp
  clientOperationId: string
  sourceDeviceId: string

billeaseAssets/signature
billeaseAssets/seal
admins/{uid}
billeaseDeliveries/{channel_operationId}
billeaseDeliveryRateLimits/{uid_channel_window}
```

`AppState` contains customers, products, invoices/quotations, payments, expenses, delivery notes, audit logs, profile, and settings. Quotations share the invoice array and are distinguished by `type`. Payments are stored in the top-level ledger and embedded on the invoice for compatibility; hydration de-duplicates by ID.

## Integrity rules

- IDs remain stable across edits.
- Customer deletion is soft; historical documents retain a customer snapshot.
- Invoice payment values are derived from the append-only payment/reversal history.
- Normal payments must be positive, dated, non-duplicated by operation ID, and cannot overpay.
- Reversals remain in history and reference the original payment.
- Quotations, delivery notes, and cancelled invoices do not contribute to collected revenue.
- Recovery snapshots precede deletes and payment changes.

## Aggregate assessment

The local fictional acceptance fixture (one customer, invoice, and payment) serialized to 3,471 bytes. Production size could not be measured without authenticated production access and was not inferred. Firestore limits a document to 1 MiB. BillEase now blocks aggregate JSON above 900,000 bytes to leave envelope/encoding headroom and compresses newly uploaded embedded logo/QR assets.

Every mutation writes the whole aggregate, hashes/serializes it, and contends on one transaction target. Different-device changes therefore conflict at the document level even when business entities differ. Reads are cheap in document-count terms, but each listener transfers and hydrates the full data set. Growth, embedded images, audit history, and frequent settings/autosave changes increase latency and failure risk.

## Recommendation: normalize Firestore

Target model:

```text
companies/{companyId}
  settings/company
  customers/{customerId}
  invoices/{invoiceId}
  quotations/{quotationId}
  deliveryNotes/{deliveryNoteId}
  payments/{paymentId}
  expenses/{expenseId}
  products/{productId}
  auditLogs/{auditLogId}
  assets/{assetId}
```

Payment documents should be immutable/idempotent and reference the invoice. Invoice summary fields may be updated atomically with a payment, while the payment ledger remains the audit authority. Security rules must enforce `companyId` membership/admin authorization and immutable financial identity fields.

## Migration plan (plan only)

1. Export and verify the aggregate plus assets; retain a checksum and revision.
2. Introduce schema version metadata and write an emulator-tested, idempotent migration script.
3. Dry-run into isolated collections and compare counts, IDs, totals, payments, reversals, customer snapshots, and report aggregates.
4. Deploy rules and indexes before client writes.
5. Add a temporary dual-read adapter: normalized first, aggregate fallback. Do not dual-write payments without an idempotency ledger.
6. Backfill production in bounded batches and validate again.
7. Cut over writes by feature flag, monitor acknowledgement/error metrics, and retain the aggregate read-only.
8. Roll back by disabling normalized writes and restoring aggregate reads; never synthesize a rollback from partial normalized data.
9. After a defined observation period, archive rather than delete the aggregate.

No migration was executed in this audit.

## Provider decision

Normalized Firestore preserves the existing Auth, client offline cache, rules model, Vercel Firebase Admin verification, and realtime listeners while removing the single-document limit/contention point. Supabase would improve SQL reporting but does not provide BillEase's browser offline mutation queue automatically; it would still require a local database/outbox/conflict layer plus Auth, RLS, server, and rollback migrations. The current sync bugs are not evidence that a provider migration is required.
