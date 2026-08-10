# Deployment

## Required client variables

```text
VITE_FIREBASE_ENABLED=true
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_BILLEASE_COMPANY_ID=kimera-vel-tech
VITE_FIRESTORE_DATA_MODE=aggregate
```

Firebase web configuration is public client configuration. Never place privileged credentials in a `VITE_` variable.

## Required server variables

```text
FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON
GMAIL_SMTP_USER
GMAIL_SMTP_APP_PASSWORD
GMAIL_FROM_NAME (optional)
APP_URL
POSTAL_LOOKUP_URL (optional; must contain {pin})
```

The service account and Gmail App Password are server-only. Confirm they are absent from `dist` and source control before deployment. Legacy Resend variables are not used by application code and should be removed manually from local/Vercel environments after verifying Gmail delivery.

## Firebase prerequisites

- Email/password Auth enabled.
- Approved admin documents at `admins/{uid}` with `active: true`, `role: admin`.
- Firestore rules from `firestore.rules` deployed after `npm run emulators:migration` passes.
- Index/TTL policy reviewed for delivery rate-limit records.

## Release gate

```text
npm install
npm run lint
npm test
npm run build
git diff --check
npm audit --omit=dev
npm run emulators:migration
```

Then inspect bundle sizes, verify no sourcemaps/secrets/debug payloads in `dist`, exercise authenticated Gmail delivery with a fictional document, and run the cross-device checklist in `MAINTENANCE.md`. Vite currently does not emit production source maps.

## Rollback

First set `VITE_FIRESTORE_DATA_MODE=aggregate` and deploy, which stops normalized writes without changing IndexedDB. If normalized writes already occurred, run the migration tool's rollback dry-run and comparison before `--apply`; it reconstructs the aggregate and retains normalized documents. See `FIRESTORE_MIGRATION.md`.
