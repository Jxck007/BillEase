# BillEase server integrations

Configure all secret values in **Vercel Project Settings → Environment Variables**. Apply them to Production and the Preview environments used for testing. Never prefix server secrets with `VITE_`.

## Required server variables

- `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` — complete Firebase Admin service-account JSON. It verifies Firebase ID tokens and checks the existing `admins/{uid}` authorization document.
- `RESEND_API_KEY` — Resend server API key.
- `RESEND_FROM_EMAIL` — a verified Resend sender, for example `billing@example.com`.
- `POSTAL_LOOKUP_URL` — postal-provider URL template containing `{pin}`. Its response must expose India Post-style `PostOffice` entries or `results` containing locality, district, and state.

Server Email is configured only when both Resend variables are present. PIN lookup is configured only when `POSTAL_LOOKUP_URL` is present. The authenticated `/api/integrations/status` function controls whether the frontend exposes either integration.

## Email behavior

- `POST /api/email/send-document` requires a valid Firebase ID token and an active `role: "admin"` document.
- The PDF limit is 3 MB after Base64 decoding so the Base64 JSON request remains below Vercel's request-body limit.
- A Firestore delivery record stores only document ID, recipient, time, provider message ID, and delivery status.
- The email body and PDF content are not written to Firestore or application logs.
- A request idempotency key is reserved transactionally before Resend is called and is also sent to Resend.

## Deployment verification

1. Deploy to a Vercel preview with the variables above.
2. Sign in as an active BillEase admin.
3. Confirm Settings reports Server Email and PIN Code Lookup as `Configured`.
4. Open an invoice or quotation, confirm the customer email is prefilled, and send to a controlled recipient.
5. Verify the received message contains the PDF attachment.
6. Confirm a repeated click does not create a second delivery.
7. Review Vercel and Resend delivery status without logging document content.

GST verification, barcode scanning, OCR, AI quick actions, and automatic WhatsApp sending remain disabled.
