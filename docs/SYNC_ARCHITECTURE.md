# Synchronization Architecture

## State contract

BillEase retains one synchronization state machine:

```text
LOCAL_SAVE_COMPLETE     IndexedDB transaction completed
CLOUD_WRITE_PENDING     durable pendingSync exists
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
  -> DataContext computes next AppState and stable operation ID
  -> React state updates immediately
  -> IndexedDB transaction commits app-state + pendingSync
  -> debounce
  -> Firestore transaction reads billease/appData revision
  -> conflict/count/size guards run
  -> backend commits revision + operation ID + device ID + server timestamp
  -> transaction promise and/or authoritative snapshot acknowledges exact operation/hash
  -> pendingSync is removed in memory and IndexedDB
  -> listener delivers the new revision to other devices
```

Firestore transactions fail offline, so native persistent cache cannot replay this transaction. The durable IndexedDB outbox is therefore required while the aggregate/revision transaction remains. A browser `offline -> online` transition or manual Retry increments an explicit retry trigger. Authentication restoration also re-enables the same durable outbox.

## Before and after

Before:

```text
failed offline transaction
  -> dirty IndexedDB record survives
  -> online event changes display only
  -> state/effect dependency does not change
  -> no new transaction
  -> “Cloud sync pending” remains

server snapshot callback
  -> clears pending
  -> transaction promise resolves afterward
  -> onPersisted sets status back to saving
  -> stale saving presentation
```

After:

```text
offline -> online
  -> retry trigger changes
  -> same durable operation ID retries

transaction commit OR matching authoritative snapshot
  -> exact operation ID + content hash checked
  -> dirty/outbox cleared once
  -> later callback becomes a no-op
```

## Entity lifecycle sequences

Invoice and quotation:

```text
InvoiceForm local form -> IndexedDB editor draft
Save -> normalize/validate -> DataContext invoice mutation
-> IndexedDB app-state/outbox -> Firestore aggregate transaction
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
-> Firestore aggregate transaction -> acknowledgement
-> second device hydrates ledger and recalculated invoice -> reports derive from invoices
```

## Conflict policy

- Different entity IDs: merge independently. Remote owns untouched entities; local owns entities named by the durable outbox.
- Same entity changed remotely since the recorded base hash: block the cloud overwrite and preserve local and incoming remote recovery snapshots.
- Same-field and different-field edits on one financial entity use the same conservative block. No field-level merge is attempted.
- Payments and reversals use stable record and operation IDs. Conflicting content for the same ID is blocked.
- Stale/equal remote revisions are ignored.
- Legacy dirty records without entity base hashes are treated as aggregate conflicts instead of guessing.

## Error policy

Retryable errors are `unavailable`, `deadline-exceeded`, `aborted`, `resource-exhausted`, and network failures. They receive at most three attempts per trigger with exponential backoff and jitter. Authentication and permission errors do not loop. Aggregate size failures are permanent and direct the operator to export a local backup and reduce embedded assets. All diagnostic events contain metadata only; entity IDs are hashed and business content is never logged.

## Firestore metadata

The listener uses `includeMetadataChanges`, rejects `fromCache` snapshots as acknowledgements, and rejects snapshots with `hasPendingWrites`. These flags help identify authoritative server snapshots. Because the write is a transaction, the resolved transaction promise is also a genuine backend commit acknowledgement. It is not equivalent to an ordinary offline `setDoc` queued in Firestore cache.

## Remaining limitation

Two tabs share the application IndexedDB record but keep separate React state and per-tab device IDs. Online Firestore distribution is deterministic under the entity-intent policy. Two tabs making unrelated offline changes before either reconnects can still replace the shared local checkpoint; do not support that workflow as lossless until entity documents or a per-operation multi-tab outbox is implemented.
