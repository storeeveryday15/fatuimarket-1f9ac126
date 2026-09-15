# Fatui Pay Verify — Signed Webhook Test Plan

## Goal
Run a safe signed test against the production receiver at
`https://fatuimarket.lovable.app/api/public/fatui-pay/verify`
to confirm the handshake works, without fulfilling any real order or
enabling live webhook delivery / Gmail scheduler.

## Preconditions (already met)
- `FATUI_PAY_WEBHOOK_SECRET` is saved in the secure store.
- Receiver code and `payment_webhook_events` table exist.
- Receiver is currently inert (returns 503 to every call).

## Steps

1. **Enable test-only mode** — set `FATUI_PAY_WEBHOOK_ENABLED=true` so the
   receiver accepts signed requests. This does **not** register the webhook
   with Fatui Pay or start any scheduled cycle; it only allows the endpoint
   to process requests instead of returning 503.

2. **Send first signed request** — POST to
   `/api/public/fatui-pay/verify` with:
   - A JSON body containing `event_id`, `event_type: "payment.verified"`,
     `payment_status: "verified"`, and a **fake order code**
     (`TEST-FAKE-0001`) so no real Fatui Market order can match.
   - `x-fatui-signature` header = HMAC-SHA256 of the exact request body
     using `FATUI_PAY_WEBHOOK_SECRET`, sent as bare hex.
   - Verify: HTTP 200, event accepted, order code parsed, no fulfilment
     triggered (unmatched order → logged and dropped).

3. **Replay the same request** — send the identical body + signature again
   with the same `event_id`. Verify: HTTP 200, duplicate event ID detected
   and ignored (no second insert, no fulfilment).

4. **Send a non-verified event** — POST a body with
   `event_type: "payment.review_required"` and a fresh event ID. Verify:
   HTTP 200, event recorded as "ignored", no fulfilment triggered.

5. **Send a bad-signature request** — POST a valid body but with a wrong
   signature. Verify: HTTP 401, request rejected before any processing.

6. **Disable test-only mode** — set `FATUI_PAY_WEBHOOK_ENABLED=false` so
   the receiver returns to its inert 503 state. No live webhook delivery
   or Gmail scheduler is enabled at any point.

## Verification criteria
- HMAC-SHA256 signature over the exact request body is validated via
  `x-fatui-signature`.
- Valid event IDs are accepted; duplicate event IDs are rejected/ignored
  idempotently.
- Fatui Market order code is correctly parsed from the payload.
- No real order is fulfilled by any test request.
- Non-verified payments (review-required, rejected, expired, unverified)
  are logged and dropped, never fulfilled.
- Bad signatures are rejected with 401.
- Receiver is switched back off after the test.

## What does NOT change
- Checkout / payment flow untouched.
- No live webhook registered with Fatui Pay.
- Gmail scheduler stays off.
- No real order is created, modified, or fulfilled.
