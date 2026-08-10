# Maintenance

## Routine checks

- Run the full suite and build for every release.
- Review `npm audit` advisories for reachability; do not force major downgrades/upgrades from automated suggestions.
- Monitor aggregate byte size and record counts. Plan normalization well before 900 KB.
- Test backup export and an isolated restore quarterly.
- Review Firestore rules, admin membership, Gmail App Password rotation, and Vercel secret scope.
- Verify recovery and delivery rate-limit collections have an intentional retention policy.

## Cross-device acceptance checklist

Use fictional data in an isolated project/emulator when possible:

1. Session A creates a customer; B sees it.
2. A creates an invoice; B sees the exact customer snapshot, totals, and ID.
3. A goes offline, edits that invoice, then reconnects; wait for cloud acknowledgement and confirm B receives it.
4. B records a partial payment; confirm A receives the stable payment ID, balance, and status.
5. Compare Dashboard and Reports totals on both sessions.
6. Test different-invoice concurrent edits (automatic entity merge).
7. Test same-invoice concurrent edits (blocked conflict and two recovery snapshots).
8. Test reload, auth expiry, permission denial, temporary failure, and two tabs.
9. Remove fictional records only through normal UI behavior when safe.

## Conflict handling

Do not press Retry repeatedly on an action-required same-entity conflict. Export both backup and diagnostics, identify the conflicting entity by the safe reference and timestamps, and manually reproduce the intended edit after reconciling business evidence. Payments/reversals must never be deleted to resolve a conflict.

## Dependency notes

- PDF (`jspdf`, `html2canvas`) and reports (`recharts`) are intentionally lazy route/service chunks but remain the largest feature bundles.
- Firebase client and Admin SDKs are both required in their respective browser/server paths.
- `motion/react` is used by modal transitions.
- `fflate`, Nodemailer, Formidable, QRCode, date-fns, and Lucide are referenced.
- Build-only packages should remain dev dependencies where deployment tooling supports it; reorganize only in a dedicated dependency commit.

## Future work order

1. Version Firestore rules and add emulator rule tests.
2. Run authenticated two-device production acceptance without real customer data.
3. Implement normalized Firestore collections behind a migration flag.
4. Add an in-app conflict review/resolution surface.
5. Split `DataContext` into repository/sync/command providers after integration coverage exists.
6. Add CI for typecheck, tests, build, secret scan, and browser accessibility checks.
