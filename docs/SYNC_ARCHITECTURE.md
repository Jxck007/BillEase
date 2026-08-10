# Synchronization Architecture

## State contract

BillEase retains one synchronization state machine:

```text
LOCAL_SAVE_COMPLETE     IndexedDB transaction completed
CLOUD_WRITE_PENDING     one or more durable pendingOperations exist
CLOUD_WRITE_ACKNOWLEDGED matching Firestore transaction committed or authoritative snapshot observed
OFFLINE                 browser offline while pending
AUTH_REQUIRED           authentication expired while pending
SYNC_RETRYING           retryable operation is being attempted with bounded backoff
SYNC_FAILED             permanent/retry-exhausted error; manual action remains available
```

UI labels are derived from pending count, browser network state, authentication, cloud availability, and the last classified result. “Synced to cloud” is shown only after the matching operation/hash is acknowledged.

## Corrected flow

```text
UI mutation
  -> entity repository requests a DataContext commit
  -> DataContext computes next AppState and stable operation ID
  -> React state updates immediately
  -> diff creates one immutable outbox operation with entity snapshots/base hashes
  -> IndexedDB transaction commits app-state + pendingOperations
  -> Firestore batch writes only those entity wrappers
  -> rules require each baseHash to match the remote contentHash
  -> payment creation and affected invoice update share one atomic batch
  -> backend commit acknowledges the stable operation ID
  -> only that operation leaves IndexedDB
  -> collection listeners deliver authoritative entity state to other devices
```

`useDataHydration` owns startup restore and recovery, `useFirestoreListeners` owns remote subscription lifecycle and conflict application, and `useNormalizedOutboxSync` owns normalized write ordering/retry. `DataContext` retains the single durable commit boundary, so extraction does not create a second state machine or outbox.

Ordinary batched writes are accepted by the Firestore client while offline and commit after reconnect. BillEase still retains its IndexedDB outbox so operation identity, entity snapshots, retry metadata, and recovery survive reloads independently of the SDK cache.

## Aggregate compatibility

`aggregate` keeps the stabilized prior transaction path. `dual-read` reads normalized data first and falls back to the aggregate, while writes use the normalized outbox. `normalized` requires normalized roots and never falls back. An aggregate-wide legacy outbox lacking entity base hashes is preserved and blocked for review rather than guessed.

## Entity lifecycle sequences

Invoice and quotation:

```text
InvoiceForm local form -> IndexedDB editor draft
Save -> normalize/validate -> DataContext invoice mutation
-> IndexedDB app-state/entity outbox -> invoices/{invoiceId} batch write
-> server acknowledgement -> second-device listener
-> hydrate/validate -> React state -> IndexedDB checkpoint
```

Customer, delivery note, and settings use the same sequence without a completed-document draft step. A customer created offline and a dependent invoice are recorded as two entity intents inside one durable aggregate outbox.

Payment and reversal:

```text
Admin confirmation -> validate stable payment operation ID
-> append payment/reversal to ledger and related invoice
-> recalculate amountPaid/balance/status using paise arithmetic
-> recovery snapshot -> IndexedDB app-state/outbox (payment + invoice refs)
-> Firestore payment + invoice atomic batch -> acknowledgement
-> second device hydrates ledger and recalculated invoice -> reports derive from invoices
```

## Conflict policy

- Different entity IDs: merge independently. Remote owns untouched entities; local owns entities named by the durable outbox.
- Same entity changed remotely since the recorded base hash: block the cloud overwrite and preserve local and incoming remote recovery snapshots.
- Same-field and different-field edits on one financial entity use the same conservative block. No field-level merge is attempted.
- Payments and reversals use stable record and operation IDs. Conflicting content for the same ID is blocked.
- A normalized update is allowed only when its stored `baseHash` equals the remote wrapper's `contentHash`.
- Legacy dirty records without entity base hashes are treated as aggregate conflicts instead of guessing.

## Error policy

Retryable errors are `unavailable`, `deadline-exceeded`, `aborted`, `resource-exhausted`, and network failures. They receive at most three attempts per trigger with exponential backoff and jitter. Authentication and permission errors do not loop. Aggregate size failures are permanent and direct the operator to export a local backup and reduce embedded assets. All diagnostic events contain metadata only; entity IDs are hashed and business content is never logged.

## Firestore metadata

The listener uses `includeMetadataChanges`, rejects `fromCache` snapshots as acknowledgements, and rejects snapshots with `hasPendingWrites`. These flags help identify authoritative server snapshots. Because the write is a transaction, the resolved transaction promise is also a genuine backend commit acknowledgement. It is not equivalent to an ordinary offline `setDoc` queued in Firestore cache.

## Remaining limitation

Two tabs still share one IndexedDB app-state record. Firestore makes replay idempotent and rejects stale same-entity writes, but two tabs independently rewriting the local checkpoint while both are offline is not a fully transactional multi-tab local database. Avoid concurrent offline editing in two tabs until the local record is split into an operation object store.
