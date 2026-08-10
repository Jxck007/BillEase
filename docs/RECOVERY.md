# Recovery Runbook

## First response

1. Keep the affected tab open if a local-storage warning says to do so.
2. Open Settings -> Backup & Diagnostics.
3. Export the application backup and privacy-safe diagnostics.
4. Record the visible error reference, time, browser, network state, and whether another device/tab was editing.
5. Do not clear IndexedDB, Firestore cache, or production documents.

## Pending sync

- Restore connectivity and authentication, then use Retry once.
- Permission errors require Firestore rules/admin investigation; repeated Retry is not useful.
- Aggregate-size errors require preserving a backup and reducing embedded logo/QR images. Do not delete financial records to make the document smaller.
- Same-entity conflicts preserve local and incoming cloud snapshots. Stop edits on other devices, export the backup/diagnostics, and compare the entity before manually applying a resolution.

## Malformed data

Hydration reports validation errors and does not silently replace records with empty arrays. Preserve the local recovery data, export Firestore through approved administrative tooling, validate in an isolated environment, and repair by an idempotent reviewed script. Never edit payment/reversal history ad hoc in production.

## Backup and restore

The Settings export is a JSON application-data backup, not a full Firebase project export. Production recovery should also use scheduled Firestore exports when billing/operations permit. Restore scripts must support dry run, schema validation, count/total comparison, stable IDs, and rollback. Test restores against the Firebase Emulator or an isolated project.

## Evidence to collect

Safe diagnostics include operation ID, hashed entity ID, local/remote revisions, operation type, queue/attempt/ack times, retry count, online/auth state, and result category. They exclude names, addresses, phones, emails, invoice content, tokens, credentials, and PDFs.
