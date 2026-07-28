# BillEase delivery integrations

All credentials are server-only Vercel environment variables. Never add a `VITE_` prefix to them and never place them in React code.

## Authentication boundary

Every API function verifies `Authorization: Bearer <Firebase ID token>` with Firebase Admin, then checks `admins/{uid}` for `active === true` and `role === "admin"`. A frontend UID or email is never accepted as identity.

`FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` contains the complete service-account JSON. Escaped newlines in `private_key` are normalized only in server code.

`firebase-admin` is pinned to the latest compatible 13.x release. Version 14.2.0 installs CommonJS `jwks-rsa@4`, which loads ESM-only `jose@6` and crashes the selected Vercel Node runtime before the handler runs. The application does not import or perform authentication with `jwks-rsa`, `jose`, `jsonwebtoken`, or custom JWKS code.

## Email

`POST /api/email/send-document` accepts the existing multipart form-data request used by the export panel. It also accepts an authenticated JSON compatibility payload containing `to`, `subject`, `message`, `fileName`, and `pdfBase64`. Both paths enforce a 3 MB decoded PDF limit, validate the PDF signature, reject header injection, and send through `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

Use `npx vercel dev` when testing `.env.local`; Vercel loads the same unprefixed variables used by Preview and Production. `APP_URL` is available for deployment-specific absolute URLs but is not exposed to React.

Delivery records contain only document ID, channel, recipient, status, timestamp, and provider message ID. A Firestore transaction reserves each idempotency key before sending. Resend also receives that key.

## Evolution Go WhatsApp

Evolution Go must run on a separate persistent server. BillEase currently includes an authenticated `POST /api/whatsapp/send-document` scaffold and the server-only configuration variables:

- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_NAME`

The scaffold returns `503` and does not call Evolution Go. Provider availability also remains false, so the export panel keeps the existing PDF-download plus `wa.me` fallback active.

Before enabling server-side WhatsApp delivery, select the deployed Evolution Go version and inspect that version's Swagger/API documentation. Only then add its verified document-upload and instance-health routes, request fields, response mapping, and session-state handling. The future provider call must use an `AbortController` timeout and must never expose the API key to browser code.

## Status

`GET /api/integrations/status` is authenticated. The response never contains credentials. The frontend caches it briefly and disables provider sends when a provider is absent or unavailable. Native Share, PDF download plus `wa.me`, and PDF download plus `mailto` stay available.

## Deployment order

1. Configure `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` in Vercel.
2. Deploy Vercel and test one controlled email with a PDF attachment.
3. Select and deploy a specific Evolution Go version separately.
4. Create and pair the WhatsApp instance.
5. Inspect that deployment's API documentation for document sending, instance health, authentication, errors, and response shapes.
6. Implement and test the verified contract in the Vercel provider.
7. Copy the API URL, API key, and instance name into Vercel.
8. Redeploy Vercel and confirm the instance reports connected.
9. Send one controlled PDF to the selected customer.
10. Enable WhatsApp for production use only after that test succeeds.
