# Repair production UTR submission

## Scope
- Keep the existing Fatui Pay Verify endpoint, Gmail matching, consumed-RRN ledger, signed webhook, and fulfillment unchanged.
- Do not create any Fatui Pay internal order or introduce another payment architecture.

## Changes
1. Correct the server-only `/api/public/submit-utr` request to send the exact Fatui Market `order_id` (order code), trusted INR amount, normalized UTR, customer/product details, a 24-hour re-evaluation window, and web item metadata.
2. Send the API key only in the server-side `x-api-key` header and never return or log it.
3. Save the UTR locally for safe retry, but only change the order to “Payment Submitted / Verifying” after Fatui Pay returns success. Return a clear retryable error otherwise.
4. Keep the existing order code and amount authoritative; never accept either from the browser beyond the authenticated order-code lookup.
5. Add focused contract tests for the generated request and failure behavior.
6. Safely replay the retained UTR for the existing ₹75 order through the corrected endpoint, without creating an order or invoking fulfillment directly, then report the non-sensitive HTTP result.

## Verification
- Confirm the corrected request reaches the existing Fatui Pay URL and returns its real HTTP status.
- Confirm the order ID and ₹75 amount match trusted Fatui Market data.
- Confirm failed forwarding does not show a false success state.
- Confirm no payment secret appears in browser data, logs, source, or chat.
