# BillEase delivery integrations

All credentials are server-only Vercel environment variables. Never add a `VITE_` prefix to them and never place them in React code.

## Authentication boundary

Every API function verifies `Authorization: Bearer <Firebase ID token>` with Firebase Admin, then checks `admins/{uid}` for `active === true` and `role === "admin"`. A frontend UID or email is never accepted as identity.

`FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` contains the complete service-account JSON. Escaped newlines in `private_key` are normalized only in server code.

`firebase-admin` is pinned to the latest compatible 13.x release. Version 14.2.0 installs CommonJS `jwks-rsa@4`, which loads ESM-only `jose@6` and crashes the selected Vercel Node runtime before the handler runs. The application does not import or perform authentication with `jwks-rsa`, `jose`, `jsonwebtoken`, or custom JWKS code.

## Email

`POST /api/email/send-document` accepts the multipart form-data request used by the export panel. It also accepts an authenticated JSON compatibility payload containing `to`, `subject`, `message`, `fileName`, and Base64 attachment content. Both paths enforce a 2 MB decoded PDF/PNG limit and a 3 MB request limit, validate the file signature, reject header injection, and send through `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

`RESEND_REPLY_TO_EMAIL` is an optional server-only reply-to address for the business owner. When it contains a valid email address, the provider sends it to Resend as `reply_to`. When it is absent or invalid, delivery continues without a reply-to value. The frontend cannot supply or override it. Keep `RESEND_FROM_EMAIL` on a verified Resend domain; do not use an arbitrary Gmail address as the sender.

Use `npx vercel dev` when testing `.env.local`; Vercel loads the same unprefixed variables used by Preview and Production.

Delivery records contain only document ID, channel, recipient, status, timestamp, and provider message ID. A Firestore transaction reserves each idempotency key before sending. Resend also receives that key.

## WhatsApp

BillEase does not use a server-side WhatsApp provider. Native Share sends the generated PDF through the Android share sheet when the browser supports file sharing. The fallback downloads the PDF, opens `wa.me` with a prefilled message, and asks the administrator to attach the downloaded file manually.

## Status

`GET /api/integrations/status` is authenticated and reports only Resend and postal lookup availability. The response never contains credentials. Native Share and PDF/PNG download plus `wa.me` remain available.

## Deployment order

1. Configure `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, optional `RESEND_REPLY_TO_EMAIL`, and `APP_URL` in Vercel.
2. Deploy Vercel without the previous build cache.
3. Confirm GET on the email endpoint returns 405.
4. Test one controlled authenticated email with a PDF attachment.
5. Verify native Share and the PDF download plus `wa.me` fallback on the target Android tablet.
