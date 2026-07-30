# BillEase Firestore schema

Production application data remains in the existing aggregate document:

`billease/appData`

```text
data: AppState
revision: number
updatedAt: Firestore server timestamp
clientOperationId: random idempotency token
sourceDeviceId: random per-session identifier (contains no personal data)
```

`AppState` contains `customers`, `products`, `invoices` (including quotations), `payments`,
`expenses`, `deliveryNotes`, `auditLogs`, `profile`, and `settings`.

Invoices, quotations, and delivery notes retain `customerId` and an embedded
`customerSnapshot` with only the fields needed to display historical documents. Empty GST,
address, phone, and email strings are valid.

The client writes through one debounced serialized queue and a Firestore transaction. A write
is rejected when its base revision is older than the cloud revision. Local IndexedDB is the
durable working copy and keeps bounded recovery snapshots. Automated tests use mocks and never
write this production document.
