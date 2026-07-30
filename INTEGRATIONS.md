# BillEase delivery integrations

All credentials are server-only Vercel environment variables. Never add a `VITE_` prefix to them and never place them in React code.

## Authentication boundary

Every API function verifies `Authorization: Bearer <Firebase ID token>` with Firebase Admin, then checks `admins/{uid}` for `active === true` and `role === "admin"`. A frontend UID or email is never accepted as identity.

`FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` contains the complete service-account JSON. Escaped newlines in `private_key` are normalized only in server code.

`firebase-admin` is pinned to the latest compatible 13.x release. Version 14.2.0 installs CommonJS `jwks-rsa@4`, which loads ESM-only `jose@6` and crashes the selected Vercel Node runtime before the handler runs. The application does not import or perform authentication with `jwks-rsa`, `jose`, `jsonwebtoken`, or custom JWKS code.

## Email

`POST /api/email/send-document` accepts the multipart form-data request used by the export panel. It also accepts an authenticated JSON compatibility payload containing `to`, `subject`, `message`, `fileName`, and Base64 attachment content. Both paths enforce the existing 2 MB decoded PDF/PNG limit and 3 MB request limit, validate the file signature, and reject header injection. The current UI sends the canonical PDF.

The provider uses Nodemailer with Gmail SMTP at `smtp.gmail.com`, port `465`, and `secure: true`. It sends plain text, escaped HTML, and the generated PDF attachment with its `application/pdf` MIME type and production filename. Authentication and the `From` address come only from server configuration; the browser cannot supply or override either.

Use `npx vercel dev` when testing `.env.local`; Vercel loads the same unprefixed variables used by Preview and Production.

Delivery records contain only document ID, channel, recipient, status, timestamp, and provider message ID. A Firestore transaction reserves each idempotency key before sending.

### Gmail SMTP setup

1. Enable Google two-step verification for `kimeraveltech@gmail.com`.
2. Create a Google App Password for BillEase. Do not use the normal Gmail password.
3. Store these server-only values in Vercel:

   ```env
   GMAIL_SMTP_USER=kimeraveltech@gmail.com
   GMAIL_SMTP_APP_PASSWORD=replace_with_google_app_password
   GMAIL_FROM_NAME=Kimera Vel Tech
   ```

`GMAIL_FROM_NAME` is optional and defaults to `Kimera Vel Tech`. Invalid/revoked App Passwords and SMTP authentication errors return `GMAIL_SMTP_AUTH_FAILED`; network failures return `GMAIL_SMTP_CONNECTION_FAILED`; Gmail message rejection returns `GMAIL_SMTP_REJECTED`. App Passwords, message bodies, attachments, and full customer records are never logged.

## WhatsApp

BillEase does not use a server-side WhatsApp provider. **Share PDF** builds a payload containing the generated canonical PDF File, title, and customer-facing text, then uses `navigator.share` only when both native methods exist and `navigator.canShare(shareData)` succeeds. The Android operating-system chooser can show WhatsApp, WhatsApp Business, Gmail, Drive, and other compatible installed apps. The user chooses the target and confirms the send; BillEase never selects an account, customer, or Send button.

**Open WhatsApp** only opens the sanitized customer chat with prefilled text and never claims to attach a file. If native file sharing is unsupported, Share PDF downloads the PDF once, opens that chat when a valid number exists, and displays: “PDF downloaded. Please attach the downloaded document in WhatsApp.” If the browser blocks the popup, BillEase displays a tappable WhatsApp link. A `wa.me` link cannot attach the local file.

## Status

`GET /api/integrations/status` is authenticated and reports only Gmail SMTP configuration and postal lookup availability. The response never contains credentials. Native Share and PDF/PNG download plus `wa.me` remain available.

## Deployment order

1. Configure `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`, `GMAIL_SMTP_USER`, `GMAIL_SMTP_APP_PASSWORD`, optional `GMAIL_FROM_NAME`, and `APP_URL` in Vercel.
2. Deploy Vercel without the previous build cache.
3. Confirm GET on the email endpoint returns 405.
4. Run `npm test`, then send one controlled authenticated email with a PDF attachment only to `kimeraveltech@gmail.com`. Confirm the API returns `provider: "gmail-smtp"` and a message ID, then verify the message in Gmail Sent and open its PDF.
5. Verify Android Chrome and Brave native Share with both WhatsApp apps, and verify the PDF download plus `wa.me` fallback on the target Android device.
6. Only after the controlled Gmail SMTP production test succeeds, manually remove `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `RESEND_REPLY_TO_EMAIL` from Vercel. BillEase never changes Vercel variables automatically.
