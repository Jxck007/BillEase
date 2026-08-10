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
- Firestore rules deployed and versioned. This repository currently lacks the rules source; add it before treating deployments as reproducible.
- Index/TTL policy reviewed for delivery rate-limit records.

## Release gate

```text
npm install
npm run lint
npm test
npm run build
git diff --check
npm audit --omit=dev
```

Then inspect bundle sizes, verify no sourcemaps/secrets/debug payloads in `dist`, exercise authenticated Gmail delivery with a fictional document, and run the cross-device checklist in `MAINTENANCE.md`. Vite currently does not emit production source maps.

## Rollback

Deploy the last known-good commit. Do not roll back Firestore data to match frontend code unless a separately reviewed data-restoration plan requires it. The sync changes are backward compatible: old dirty IndexedDB records without outbox metadata are preserved and handled conservatively as aggregate conflicts.
