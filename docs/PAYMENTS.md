# BillEase payment rules

BillEase stores invoice payments as append-only business records inside the existing `billease/appData` application state. Every normal payment, correction replacement, and reversal is saved locally to IndexedDB first and then synchronized through the existing Firestore revision queue. Existing invoices are normalized in memory with an empty history, zero paid, their original total due, and `unpaid`; no destructive migration changes historical totals.

Amounts are summed as integer paise. Cancelled invoices are excluded from invoiced and collectible totals. Quotations and delivery notes are never treated as collected revenue. An outstanding invoice is overdue only when it has a valid due date earlier than today.

## Static UPI limitation

The invoice QR is a static UPI intent that pre-fills the validated payee, current balance, INR currency, invoice number, and a unique BillEase reference. It does not verify settlement. A QR scan, browser return URL, screenshot, or client-supplied `SUCCESS` result must never create a payment or change invoice status. BillEase does not read bank SMS, notifications, credentials, or banking applications. An authorized BillEase admin must verify and record the payment manually.

No UPI PIN, banking password, payment-provider secret, Gmail credential, or Firebase credential belongs in payment records or audit events.

## Future provider-neutral flow

The optional `PaymentProvider` interface declares `createPaymentRequest`, `verifyWebhook`, and `getPaymentStatus` without adding provider dependencies or credentials. A future gateway flow is:

Invoice → unique provider payment link or dynamic QR → customer payment → signed server webhook → verify signature → match invoice/reference and amount → append payment record → recalculate paid/partially-paid status.

An unverified client callback must never update payment status.
