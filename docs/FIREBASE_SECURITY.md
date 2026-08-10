# Firebase security and CI enforcement

## Authorization contract

BillEase uses Firebase Authentication for identity and `admins/{uid}` for authorization. A client is an authorized administrator only when the document exists with:

```text
active: true
role: admin
companyId: kimera-vel-tech
```

For compatibility with existing administrator documents, an active admin without `companyId` can access only `kimera-vel-tech`. It cannot access another company. Clients can read only their own admin record and can never create or modify administrator records.

Normalized entity creation requires a stable operation ID and content hash. Updates additionally require `baseHash` to match the remote `contentHash`, which rejects stale same-entity writes. Deletes are represented as guarded tombstones; direct client deletes are denied. Payment and reversal records are immutable creations and are allowed only in a batch whose affected invoice receives the same operation ID.

The legacy `billease/appData` document and its recovery subcollection remain available to active admins during migration compatibility. Migration marker documents are readable but cannot be modified by clients. All unmatched paths are denied.

## Reproducible Firebase configuration

- `firestore.rules` is the authoritative rules source.
- `firestore.indexes.json` records the currently empty composite-index set.
- `firebase.json` binds those files and configures the Firestore Emulator on `127.0.0.1:8080`.
- `npm run test:firestore-rules` runs the named authorization suite against an existing emulator.
- `npm run test:firebase` starts the emulator and runs security plus migration/cross-device tests with fictional data.

No Firebase Admin credential is used by emulator tests or CI.

## Required merge gate

`.github/workflows/production-gates.yml` runs on every pull request and push to `main`:

```text
npm ci
npm run lint
npm test
npm run test:firebase
npm run build
git diff --check
npm run security:secrets
```

The workflow has read-only repository permissions and sets Firebase to local test mode. Email provider tests use mocks; CI never receives Gmail, WhatsApp, Firebase Admin, or production Firebase credentials.

Repository administrators must mark `Financial, persistence and security gates` as a required status check in the `main` branch ruleset. The workflow fails closed, but GitHub branch protection is what prevents an administrator from merging a failed or missing check.
