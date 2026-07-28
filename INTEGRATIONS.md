# BillEase delivery integrations

All credentials are server-only Vercel environment variables. Never add a `VITE_` prefix to them and never place them in React code.

## Authentication boundary

Every API function verifies `Authorization: Bearer <Firebase ID token>` with Firebase Admin, then checks `admins/{uid}` for `active === true` and `role === "admin"`. A frontend UID or email is never accepted as identity.

`FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` contains the complete service-account JSON. Escaped newlines in `private_key` are normalized only in server code.

`firebase-admin` is pinned to the latest compatible 13.x release. Version 14.2.0 installs CommonJS `jwks-rsa@4`, which loads ESM-only `jose@6` and crashes the selected Vercel Node runtime before the handler runs. The application does not import or perform authentication with `jwks-rsa`, `jose`, `jsonwebtoken`, or custom JWKS code.

## Email

`POST /api/email/send-document` accepts the existing multipart form-data request used by the export panel. It also accepts an authenticated JSON compatibility payload containing `to`, `subject`, `message`, `fileName`, and `pdfBase64`. Both paths enforce a 3 MB decoded PDF limit, validate the PDF signature, reject header injection, and send through `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

Use `npx vercel dev` when testing `.env.local`; Vercel loads the same unprefixed variables used by Preview and Production.

Delivery records contain only document ID, channel, recipient, status, timestamp, and provider message ID. A Firestore transaction reserves each idempotency key before sending. Resend also receives that key.

## Evolution Go WhatsApp

Evolution Go must run on a separate persistent server. BillEase uses these server-only configuration variables:

- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_ID`
- `EVOLUTION_INSTANCE_NAME`

The adapter targets the inspected Evolution Go `0.7.2` contract:

- `GET /instance/status` with `apikey`, `instanceId`, and `instanceName` headers.
- `POST /send/media` as `multipart/form-data`.
- Multipart fields: `number`, `type=document`, `caption`, `filename`, `id`, and binary `file`.

The `0.7.2` handler source explicitly supports direct multipart file upload, so BillEase does not create a media URL, use a Vercel filesystem URL, send a Base64 data URL, or require temporary object storage. `EVOLUTION_INSTANCE_ID` is sent on every Evolution request as the primary deployment identifier. The configured `EVOLUTION_API_KEY` must be the credential accepted by the deployed instance-scoped routes.

Confirm the separately deployed Swagger and authentication behavior are `0.7.2`-compatible before adding the Evolution variables to Vercel. If that deployment requires a media URL instead, leave WhatsApp disabled until approved temporary object storage and cleanup are implemented.

## Status

`GET /api/integrations/status` is authenticated. Evolution health uses a 3.5-second timeout and is cached server-side for 30 seconds. The response never contains credentials. The frontend also caches it briefly and disables provider sends when a provider is absent, unavailable, or disconnected. Native Share, PDF download plus `wa.me`, and PDF download plus `mailto` stay available.

## Deployment order

1. Configure `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` in Vercel.
2. Deploy Vercel and test one controlled email with a PDF attachment.
3. Deploy an Evolution Go `0.7.2`-compatible version separately.
4. Create and pair the WhatsApp instance.
5. Confirm its Swagger and authentication match the documented `/send/media` multipart and `/instance/status` contract.
6. Copy the API URL, API key, instance ID, and instance name into Vercel.
7. Redeploy Vercel.
8. Confirm the authenticated integration status reports the instance connected.
9. Send one controlled PDF to the selected customer.
10. Enable WhatsApp for production use only after that test succeeds.
