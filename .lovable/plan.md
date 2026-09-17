# Fatui Pay, Wallet, Reviews, Replies, and Leaderboard

## Inspection findings

### Payments
- Razorpay is a parallel payment rail, not part of Fatui Pay Verify. Active code exists in `src/lib/razorpay.functions.ts`, `src/routes/orders.$code.tsx`, `src/lib/wallet.functions.ts`, and `src/routes/wallet.tsx`; customer-facing Razorpay claims also remain in the buy pages, SEO content, and AI store guidance.
- There are no Razorpay webhook routes, dedicated Razorpay tables, or Razorpay packages. The generic `orders.payment_method` field contains some historical `razorpay` values and should be retained for old records.
- The normal order path already creates an idempotent order, displays the five-minute timer, accepts UTR/RRN through a protected server function, forwards the server-owned order code and amount to Fatui Pay Verify, polls only that order, validates the signed webhook, rejects mismatched amounts/RRNs, blocks consumed RRNs, and invokes the existing supplier fulfilment path.
- Old screenshot remnants remain only in admin/order-notification code and historical schema/storage; customer checkout no longer uploads screenshots.

### Wallet
- Wallet balance is stored on the customer profile; the append-only transaction ledger records top-ups, spends, refunds, cashback, and adjustments.
- Spending, refunds, and cashback are database-controlled and independent of Razorpay. Only adding money currently depends on Razorpay.
- `credit_wallet_topup` already credits atomically and uses a unique ledger reference to prevent replay, but it currently receives a Razorpay payment ID. Wallet top-ups need their own Fatui Pay payment record and must share permanent RRN consumption with product orders.

### Reviews and replies
- Reviews default to `pending`; the form inserts directly under owner-only RLS and tells customers to await approval.
- Database triggers derive the public display name and prevent customers changing ownership, status, or display identity. The public verified badge is calculated from real `completed`/`delivered` orders and is not customer-controlled.
- React renders review text as escaped text. The public-safe view hides private identity fields, but direct anonymous access to approved base rows should be removed so the view is the only public read path.
- No review reply table or reusable reply feature currently exists.

### Leaderboard
- The storefront requests 10 rows initially and can request up to 50; there is no `.slice(0, 4)` or four-row query limit.
- The exact database rule is: group real INR orders by signed-in customer, include only `completed` or `delivered`, rank by total spend then order count, and mask the profile name. Current data has 6 eligible orders belonging to exactly 4 distinct customers, which is why approximately four appear.
- The current database function is authenticated-only while the leaderboard is on the public homepage, so guest reads are unreliable. Reviews are not currently represented in leaderboard data.

## Implementation

### 1. Remove Razorpay without disturbing Fatui Pay
- Remove the Razorpay server module, browser script loaders, checkout buttons, handlers, wallet imports, API calls, and all Razorpay-specific text.
- Replace stale Razorpay/card claims in buying pages, SEO copy, and AI store guidance with the existing UPI → UTR/RRN → automatic verification wording.
- Remove stale screenshot-review UI and screenshot notification wording, while retaining historical database fields/files so old records are not destructively deleted.
- Remove stored Razorpay secrets after no code references remain. Preserve historical `payment_method='razorpay'` records for audit history.

### 2. Move wallet top-ups onto Fatui Pay Verify
- Add a `wallet_topups` table for a signed-in customer, server-authoritative INR amount, unique top-up code/idempotency key, UTR, five-minute expiry, grace window, verification state, and timestamps. Customers may only read their own rows; creation and state changes happen through protected server functions.
- Add a server-only consumed-RRN registry shared by product orders and wallet top-ups. Backfill already consumed order RRNs. A single atomic database function will claim the normalized RRN, validate target/amount/state, and either mark an order paid or credit a wallet once.
- Replace wallet Razorpay functions with protected Fatui Pay functions: create/reuse one top-up attempt, submit/update UTR while unpaid, forward the top-up code and exact server-owned amount using `FATUI_PAY_API_KEY`, and read only that top-up’s status.
- Extend the existing signed webhook receiver to resolve either an order code or wallet top-up code. Keep event-id idempotency, exact RRN and amount matching, review/duplicate rejection, and existing product fulfilment unchanged. Wallet success calls the atomic credit path; replay cannot credit twice.
- Rework the wallet page to show the existing QR/UPI details, five-minute countdown, UTR input, safe status refresh, and automatic polling. No browser-provided success signal can change balance.

### 3. Auto-publish secure reviews and add replies
- Change valid new reviews to database-enforced `approved` status automatically; update the success message and refresh behavior. Keep owner-only insert/update rules, masked display-name trigger, length/rating checks, and server-derived verified-purchase badge.
- Remove anonymous access to the base reviews table and keep public reads through the limited public view only.
- Add a `review_replies` table and public-safe view. Store author ownership internally, derive the masked customer identity in the database, derive official-store status from the server-side admin role, and never expose email/user IDs.
- Allow signed-in customers to create/edit/delete only their own customer replies; allow admins to moderate all replies and post official replies. Add database length/rate/identity protections so customers cannot forge seller replies or another identity.
- Add compact reply controls to each review: collapsed by default, “View 1 reply” / “View N replies,” expand/collapse, mobile-friendly customer reply form, and an official reply row using the existing Fatui Market logo and “Fatui Market Seller.”
- Add official reply controls to the existing admin Reviews area without exposing the admin account identity.

### 4. Make the leaderboard reliably public and live
- Replace the browser’s direct RPC call with a public server function that returns only masked name, country, fulfilled-order totals, spend, tier, and approved-review count. It will use the same `completed`/`delivered` eligibility rule, cap requests reasonably, and expose no email, phone, UTR, payment, or order details.
- Refresh on an interval and after relevant order/review changes so newly fulfilled purchases update automatically; approved reviews update the eligible customer’s review count.
- Keep the initial top-ten/full-list interaction, but remove dependence on guest database execute permissions. Do not invent customers or count pending, paid-only, failed, rejected, duplicate, cancelled, expired, or unverified orders.

## Verification

- Run focused type checks/tests and a final repository scan proving no active Razorpay API, script, UI, secret reference, or obsolete screenshot-verification copy remains.
- Add automated database-backed tests for wallet top-up idempotency, exact amount/RRN validation, shared consumed-RRN uniqueness, duplicate webhook replay, and no credit before verified payment—using fake codes/RRNs only and cleaning up fixtures.
- Test the existing product payment path with safe signed fixtures: verified fulfilment handoff, wrong amount, duplicate RRN, and replay protection, without real payment or changing the webhook/Gmail scheduler enablement.
- Replace the old review approval test with auto-publication/security tests; test forged verified/seller identity rejection, genuine purchaser badge retention, customer/admin replies, privacy-safe public views, and reply collapse/expand in desktop and mobile views.
- Test leaderboard output with temporary eligible fixtures to prove more than four rows can be returned, then clean them up; verify new completed orders and approved reviews refresh results while ineligible statuses never count.
- Verify wallet, order, review, leaderboard, and admin screens in desktop and mobile preview. Existing products, prices, supplier integration, Gmail OAuth, Fatui Pay secrets/settings, and fulfilment behavior remain untouched.

## Important operational note

The Fatui Pay receiver’s enabled/disabled setting and the Gmail scheduler will not be changed. End-to-end tests will use safe internal fixtures and mocks, not real payments.
