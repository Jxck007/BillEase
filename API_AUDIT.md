# BillEase API and server inventory

Audited on 2026-07-30. Gmail provider and document-sharing behavior have mock-based Node tests; Firebase authorization and controlled live endpoint verification remain deployment checks.

| File | Callers | Environment | Documentation | Production purpose | Decision |
| --- | --- | --- | --- | --- | --- |
| `api/email/send-document.ts` | `src/services/documentDeliveryService.ts` | `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`, Gmail OAuth variables | README, INTEGRATIONS | Authenticated administrator Gmail delivery with PDF/PNG-compatible route contract | Keep |
| `api/integrations/status.ts` | `src/services/documentDeliveryService.ts` through `useIntegrationAvailability` | Firebase Admin variables, Gmail OAuth variables, optional `POSTAL_LOOKUP_URL` | INTEGRATIONS | Authenticated capability status for Gmail and postal lookup | Keep |
| `api/postal/lookup.js` | `src/services/integrations.ts` through `PinLookupField` | `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`, optional `POSTAL_LOOKUP_URL` | INTEGRATIONS | Authenticated PIN-code address lookup | Keep |
| `api/errors/report.js` | Authenticated failures from `src/services/integrations.ts` | `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` | This inventory | Sanitized integration error metadata; never receives document content | Keep |
| `api/_auth.js` | `api/postal/lookup.js`, `api/errors/report.js` | Firebase Admin variables through server auth | INTEGRATIONS | Shared compatibility exports for admin verification and safe errors | Keep |
| `server/auth/firebaseAdmin.ts` | `verifyAdminRequest.ts` | `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` | README, INTEGRATIONS | Lazy Firebase Admin app, Auth and Firestore initialization | Keep |
| `server/auth/verifyAdminRequest.ts` | Email, status, postal and error-report routes | Firebase Admin variables | INTEGRATIONS | Firebase ID-token verification and active administrator lookup | Keep |
| `server/http/errors.ts` | API routes and server providers/helpers | None | INTEGRATIONS | Normalized safe HTTP errors | Keep |
| `server/delivery/base64DocumentRequest.ts` | Email route | None | INTEGRATIONS | JSON/Base64 email request parsing and PDF/PNG validation | Keep |
| `server/delivery/parseDocumentMultipart.ts` | Email route and Base64 limits | None | INTEGRATIONS | Multipart parsing, attachment limits, signature validation and temporary-file cleanup | Keep |
| `server/delivery/deliverySecurity.ts` | Email route | Firestore through verified Admin request | INTEGRATIONS | Email rate limiting and idempotent delivery reservation | Keep |
| `server/delivery/trustedApplicationData.ts` | Email multipart path | Firestore through verified Admin request | INTEGRATIONS | Confirms document/customer identity against trusted stored data | Keep |
| `server/providers/gmailEmailProvider.ts` | Email route and integration status | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER_EMAIL` | README, INTEGRATIONS | OAuth token refresh, MIME construction, Gmail API request, timeout and safe provider-error normalization | Keep |

## Removed integrations and dead code

- `api/whatsapp/send-document.ts`: Evolution Go-only route; removed.
- `server/providers/evolutionGoProvider.ts`: postponed Evolution Go provider; removed.
- Evolution health/status fields and frontend delivery state: removed.
- `normalizeWhatsAppNumber`: zero-caller server helper from the removed provider path; removed.
- `getFirebaseAdminAuth`: zero-caller duplicate accessor; removed.
- Disabled GST/OCR/AI/barcode provider placeholders: zero-caller experimental declarations; removed.
- Unauthenticated error-boundary request to the admin-only error route: unreachable reporting branch; removed while retaining local safe metadata logging.

Generic browser sharing remains implemented in `ExportPanel.tsx`: supported devices use `navigator.share` with the generated canonical PDF; other browsers download the PDF once and open `wa.me` for manual attachment. Independent PNG download remains available.
