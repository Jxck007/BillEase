# Offline Behavior

## Supported

- Completed customer/document/payment/settings mutations update the open UI immediately and commit to IndexedDB before the command reports success.
- Invoice, quotation, and delivery-note editors autosave separate IndexedDB drafts after a debounce and on visibility/page-hide best effort.
- One durable aggregate outbox survives reload, browser crash, temporary network failure, and authentication refresh.
- Reconnect automatically restarts a dirty transaction. Manual Retry is available after a failed attempt.
- Firestore persistent multi-tab cache supports cached remote reads, but it is not the transaction outbox.

## Status meanings

- Saving on device: IndexedDB commit has not completed.
- Saved on device / pending: local commit completed and a durable outbox exists.
- Offline: pending data is local and the browser reports no network.
- Sign-in required: pending data is local; authentication must be restored.
- Synced: matching operation/hash reached the Firestore backend.
- Action required: permission, same-entity conflict, invalid remote data, local persistence failure, or aggregate-size failure needs intervention.

## Reload and close

Completed business mutations await the IndexedDB transaction completion. Closing after success therefore retains the operation ID and entity base hashes. Editor `pagehide` draft writes are best effort because browsers cannot guarantee arbitrary asynchronous work during termination; users should wait for “Draft saved on this device” before closing.

## Multi-tab

Firestore uses a multiple-tab cache manager and each tab has a distinct session device ID. A new tab loads the shared IndexedDB checkpoint. React state is not broadcast between tabs while fully offline. Avoid simultaneous offline editing in two tabs; online changes reconcile through Firestore, while same-entity edits are blocked as conflicts.

## Unsupported/limited

- Firestore transactions themselves do not run offline.
- There is no background service worker sync after every BillEase tab is closed.
- Visual signature/seal writes use their separate Firestore documents and are not part of the application outbox.
- Same-entity conflicts require recovery export/manual resolution; there is no in-app field-by-field resolver yet.
