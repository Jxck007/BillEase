# Firestore normalization runbook

## Safety contract

- All commands target the Firestore Emulator unless `--production` and an exact `--confirm-project` are both supplied.
- Backup, migration, restore, and rollback are dry-run unless `--apply` is supplied.
- The migration is create-only and idempotent. Existing mismatched normalized documents abort the run.
- `billease/appData`, IndexedDB drafts, recovery snapshots, and pending outbox operations are never deleted.
- Backup artifacts contain private business data. They are mode `0600` under ignored `.vercel/migration-backups`; never commit or attach them to diagnostics.

## Gate sequence

```text
1. npm run migration:backup -- --production --confirm-project PROJECT
2. Verify the printed SHA-256 checksum and secure-copy the artifact.
3. npm run emulators:migration
4. npm run migration:dry-run -- --backup FILE --production --confirm-project PROJECT
5. Deploy reviewed firestore.rules and the compatibility-capable application with data mode aggregate.
6. Re-run backup and dry-run immediately before backfill.
7. Add --apply to the migration command.
8. npm run migration:verify -- --backup FILE --production --confirm-project PROJECT
9. Set data mode dual-read for observation and execute the manual two-device checklist.
10. Set data mode normalized only after observation succeeds.
```

The comparison gate covers collection counts, exact ID sets, full semantic state hash, invoice and quotation totals in paise, payment effect, outstanding balance, customer snapshot hashes, and payment operation IDs. CLI output exposes only counts and checksums, not business records or raw IDs.

## Idempotence and historical safety

Invoice and quotation objects are copied byte-for-byte into wrapper `data`; no recalculation or hydration rewrite is applied. Original mixed-array order is retained as `position`. A known legacy serializer could store a shared top-level payment alias as `null`; when that occurs, the migration recovers the identical stable payment from its preserved invoice history. Conflicting copies or duplicate operation IDs abort migration.

## Cutover modes

- `aggregate`: stabilized legacy read/write path; default.
- `dual-read`: normalized read first, aggregate fallback; mutations use normalized entity batches.
- `normalized`: normalized root is required; no aggregate fallback.

Do not enable `dual-read` before normalized verification. Unknown aggregate-wide legacy pending operations stay durable and require manual review. Entity-scoped legacy operations retain their stable operation ID and are enriched with their saved entity snapshot.

## Rollback

Exact pre-migration restore:

```text
npm run migration:restore -- --backup FILE --production --confirm-project PROJECT
```

Post-cutover rollback from current normalized data:

```text
npm run migration:rollback -- --production --confirm-project PROJECT
npm run migration:rollback -- --production --confirm-project PROJECT --apply
```

The apply command first writes a fresh aggregate safety backup, then reconstructs `AppState` from normalized wrappers and advances the aggregate revision. It does not delete normalized documents. Deploy `aggregate` mode after verification.

## Manual acceptance

Use fictional records and two authenticated sessions:

1. A creates a customer; B observes it.
2. A creates an invoice; B observes it.
3. A edits invoice 1 while B edits invoice 2; both survive.
4. A edits offline, reconnects, receives acknowledgement, and B observes the exact edit.
5. B records a partial payment; A sees the immutable payment and updated invoice balance; reports match.
6. Reload A while an outbox operation is pending and confirm it resumes.

Keep the aggregate throughout the observation window. Removal or archival requires a separate approval.
