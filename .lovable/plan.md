# Generalize Supplier Architecture

## Scope
- Preserve Fatui Pay, UPI/UTR verification, checkout, customer pricing, order identifiers, and payment webhooks unchanged.
- Reuse the existing orders, catalog, supplier registry, supplier catalog, supplier-order, sync-history, and admin systems.
- Do not add a second provider implementation until its official API contract and credentials are supplied.

## Database
- Add `supplier_key` to `supplier_orders`, default and backfill existing records to `flashtopup`, then enforce it as required.
- Add `supplier_key` to `supplier_webhook_events`, default and backfill existing records to `flashtopup`, then enforce it as required.
- Preserve the unique constraints on `supplier_orders.order_id` and `supplier_orders.reference_id`.
- Replace global webhook event uniqueness with provider-scoped uniqueness on `(supplier_key, event_id)` while preserving RLS and grants.

## Provider Dispatch
- Introduce a server-only provider adapter contract for order creation, status lookup, optional ID checks, catalog sync capabilities, webhook verification, and status normalization.
- Wrap the existing FlashTopup client as the first adapter without changing its authentication or request signing.
- Resolve providers only on the server from `catalog_products → supplier_services → supplier_products.supplier_key`.
- Keep one existing `supplier_orders` record per customer order; save its resolved provider key before any external call.
- Route fulfillment and status polling through the provider registry, with safe handling for missing mappings or unsupported providers.

## FlashTopup Webhook
- Keep the existing endpoint and raw-body HMAC verification.
- Scope event deduplication and supplier-order lookup to `flashtopup`.
- Preserve constant-time signature checks, idempotent order updates, and safe delivery payload storage.

## Admin
- Generalize supplier catalog reads so each product and service displays its provider.
- Keep FlashTopup-specific sync and diagnostics controls explicitly tied to FlashTopup.
- Preserve supplier activation, priority, health, auto-ordering, mappings, and order status behavior.

## Validation
- Add unit tests for provider resolution/dispatch, missing or invalid mappings, provider-scoped duplicate webhook IDs, FlashTopup status normalization/signature verification, and client-controlled supplier rejection by design.
- Run existing payment webhook tests as a regression check without editing payment code.
- Use mocks/diagnostics only; never place a real supplier order.
- Diagnose the 191-products/0-services state before altering mappings. Current evidence indicates service requests fail upstream before insertion; confirm the exact sanitized supplier response and report it.
