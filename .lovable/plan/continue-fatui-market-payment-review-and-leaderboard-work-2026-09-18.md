# Continue Fatui Market Payment, Review, and Leaderboard Work

## Protected configuration

- Do not run the authentication signing-key migration again. The backend already has an active ES256 authentication key, so no migration is needed.
- Do not generate or rotate authentication keys, `FATUI_PAY_WEBHOOK_SECRET`, `FATUI_PAY_API_KEY`, Gmail credentials, supplier credentials, or any other production secret.
- Preserve the existing Fatui Pay HMAC webhook signature contract and configured webhook destination unchanged.
- Keep the Fatui Pay receiver enablement and Gmail scheduler settings unchanged.

## Implementation

1. Remove active Razorpay checkout, wallet top-up calls, scripts, buttons, environment references, and customer-facing Razorpay wording. Preserve historical payment records.
2. Keep all product checkout payments on the existing UPI, UTR/RRN, Fatui Pay, Gmail verification, signed webhook, and supplier-fulfilment flow. Remove obsolete screenshot-review surfaces without deleting historical records.
3. Move wallet top-ups onto the same verified Fatui Pay flow with five-minute expiry, exact amount/RRN checks, permanent shared RRN consumption, webhook replay protection, and atomic one-time wallet credit.
4. Auto-publish valid customer reviews while retaining owner protections, masked names, escaped content, anti-spam validation, and the genuine completed-purchase badge.
5. Add collapsed customer review replies and official “Fatui Market Seller” replies using the existing brand logo. Keep reply ownership private and prevent customers forging seller identity.
6. Keep the leaderboard restricted to genuine completed/delivered orders, add approved review counts, retain masked identities, make guest loading reliable, and prevent customers altering protected order states.
7. Update the admin review area for official replies and remove obsolete payment-proof UI without changing unrelated admin tools.

## Verification

- Test fake wallet and product payment events for correct amount, wrong amount, duplicate RRN, shared RRN collision, duplicate webhook replay, expiry, and one-time fulfilment/credit.
- Test review auto-publication, verified-buyer derivation, reply ownership, official seller identity, privacy-safe public views, and mobile/desktop collapsed reply controls.
- Test the leaderboard with more than four eligible fixtures, live refresh, fulfilled-only eligibility, review counts, and masked customer details.
- Confirm no active Razorpay or customer payment-screenshot flow remains and no payment/authentication secret changed.

## Migration correction

The first application database migration attempt failed transactionally because the leaderboard function’s return columns changed without dropping the old function first. Before retrying, confirm that none of that failed migration was applied, then apply one corrected atomic migration. This database migration is unrelated to authentication signing keys.