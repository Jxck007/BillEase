# BillEase delivery integrations

All credentials are server-only Vercel environment variables. Never add a `VITE_` prefix to them and never place them in React code.

## Authentication boundary

Every API function verifies `Authorization: Bearer <Firebase ID token>` with Firebase Admin, then checks `admins/{uid}` for `active === true` and `role === "admin"`. A frontend UID or email is never accepted as identity.

`FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` contains the complete service-account JSON. Escaped newlines in `private_key` are normalized only in server code.

`firebase-admin` is pinned to the latest compatible 13.x release. Version 14.2.0 installs CommonJS `jwks-rsa@4`, which loads ESM-only `jose@6` and crashes the selected Vercel Node runtime before the handler runs. The application does not import or perform authentication with `jwks-rsa`, `jose`, `jsonwebtoken`, or custom JWKS code.

## Email

`POST /api/email/send-document` accepts the multipart form-data request used by the export panel. It also accepts an authenticated JSON compatibility payload containing `to`, `subject`, `message`, `fileName`, and Base64 attachment content. Both paths enforce the existing 2 MB decoded PDF/PNG limit and 3 MB request limit, validate the file signature, and reject header injection. The current UI sends the canonical PDF.

The provider uses Gmail API `users.messages.send` with `userId=me`. It refreshes a short-lived access token server-side and sends a MIME message containing plain-text and HTML alternatives plus an `application/pdf` attachment with the generated filename. The `From` header comes only from `GMAIL_SENDER_EMAIL`, which validation fixes to `kimeraveltech@gmail.com`; the browser cannot supply or override it.

Use `npx vercel dev` when testing `.env.local`; Vercel loads the same unprefixed variables used by Preview and Production.

Delivery records contain only document ID, channel, recipient, status, timestamp, and provider message ID. A Firestore transaction reserves each idempotency key before sending.

### Gmail OAuth setup

1. In the Google Cloud project for the sending account, enable the Gmail API and configure an OAuth consent screen.
2. Create an OAuth 2.0 client and authorize only `https://www.googleapis.com/auth/gmail.send` for `kimeraveltech@gmail.com`.
3. Complete the authorization-code flow with offline access and consent to obtain a refresh token. Do not use the Gmail password or an app password.
4. Store these server-only values in Vercel:

   ```env
   GMAIL_CLIENT_ID=
   GMAIL_CLIENT_SECRET=
   GMAIL_REFRESH_TOKEN=
   GMAIL_SENDER_EMAIL=kimeraveltech@gmail.com
   ```

The refresh token must belong to the Gmail account above. A revoked/expired authorization returns `GMAIL_AUTH_REVOKED`; invalid OAuth client credentials return `GMAIL_AUTH_FAILED`; Gmail send rejection returns `GMAIL_API_REJECTED`. Tokens, message bodies, Base64 content, and customer data are never logged.

## WhatsApp

BillEase does not use a server-side WhatsApp provider. Native Share sends the generated canonical PDF through the Android share sheet when `navigator.canShare({ files: [pdfFile] })` succeeds. The user chooses WhatsApp or WhatsApp Business and confirms the send; the application never selects an account or automates sending. The selected app uses the WhatsApp account currently logged in on the device.

If native file sharing is unsupported, BillEase downloads the PDF once, opens the sanitized customer number through `wa.me` with prefilled text, and displays: “PDF downloaded. Please attach the downloaded document in WhatsApp.” A `wa.me` link cannot attach the local file.

## Status

`GET /api/integrations/status` is authenticated and reports only Gmail configuration and postal lookup availability. The response never contains credentials. Native Share and PDF/PNG download plus `wa.me` remain available.

## Deployment order

1. Configure `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER_EMAIL`, and `APP_URL` in Vercel. The old `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `RESEND_REPLY_TO_EMAIL` variables are no longer required and are not removed automatically.
2. Deploy Vercel without the previous build cache.
3. Confirm GET on the email endpoint returns 405.
4. Run `npm test`, then test one controlled authenticated email with a PDF attachment sent only to the father's own Gmail address.
5. Verify Android Chrome and Brave native Share with both WhatsApp apps, and verify the PDF download plus `wa.me` fallback on the target Android device.
