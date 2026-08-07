# FlashTopup Full Automation

Turn the FlashTopup supplier link into an end-to-end automatic fulfilment pipeline: services sync, player-ID verification, automatic order placement after payment, status polling, and instant webhook updates.

## 1. Services sync

- New table `supplier_services` linked to `supplier_products`, storing service name, service code, supplier price, currency, min/max quantity, validation code, and the required input fields (user_id, server_id, etc.) as structured JSON.
- "Sync Services" button in Supplier Catalog, plus automatic service sync right after a product sync finishes.
- Each product row expands to show its services (price, currency, quantity range, required inputs).
- Per-service selector to map a supplier service to one of your Fatui Market catalog products. This mapping is what drives automatic fulfilment.

## 2. Player ID verification (Check-ID)

- On the product/checkout page, when the chosen product is mapped to a supplier service that requires validation, the player ID (and server, if needed) is verified against FlashTopup before payment.
- The returned nickname is shown for confirmation.
- Checkout stays blocked until verification succeeds; products with no validation requirement skip the step entirely.

## 3. Automatic order placement

- Once payment is confirmed (Razorpay or admin-approved UPI), the system builds a unique reference id from the order code and sends the order to FlashTopup with service code, player id, server, and quantity.
- Supplier order id, status, and the raw response are stored on the order.
- The same reference id is always reused, so a retry can never create a duplicate supplier order.

## 4. Status polling

- Orders sitting in "processing" at the supplier are polled and their local status updated to processing / completed / failed.
- Polling stops as soon as the order is completed or failed.
- Completed supplier delivery flips the customer order to completed, which already triggers cashback, stock and notifications.

## 5. Webhook

- Secure endpoint at `/api/public/flashtopup/webhook`.
- HMAC signature verified with the API key; invalid signatures rejected with 401.
- Duplicate events ignored by `event_id`.
- Status updates applied instantly; delivered codes/vouchers saved and shown to the customer.
- Returns 200 immediately after processing.

## 6. Customer experience

Pick game -> pick package -> player ID verified with nickname shown -> pay -> order auto-sent to supplier -> webhook marks it Completed with delivery details, all without admin action. Admin only steps in when the supplier reports an error, which surfaces in the admin order view with the supplier's message.

---

## Technical details

**Migration**

- `public.supplier_services`: `id`, `supplier_product_id` FK -> `supplier_products` (cascade), `service_code` (unique with product), `service_name`, `supplier_price numeric`, `currency text`, `min_quantity int`, `max_quantity int`, `validation_code text`, `input_fields jsonb`, `requires_validation boolean`, `raw jsonb`, `active boolean`, `catalog_product_id` FK -> `catalog_products` null, timestamps. GRANT select/insert/update/delete to `authenticated`, ALL to `service_role`, no anon. RLS admin-only via `has_role`. `touch_updated_at` trigger.
- `public.supplier_orders`: `order_id` FK -> `orders` unique, `service_code`, `reference_id` unique, `supplier_order_id`, `status`, `last_response jsonb`, `delivered_payload jsonb`, `error_message`, timestamps. Admin-only RLS; owner can read a safe subset via the order.
- `public.supplier_webhook_events`: `event_id` unique, `payload jsonb`, `created_at`. Service-role only.
- `orders` gains `supplier_status text`, `supplier_order_id text`, `delivery_details text`.

**Server**

- Extend `src/lib/flashtopup.server.ts` with `listServices(productCode)`, `checkId(...)`, `createOrder(...)`, `orderStatus(...)`, and `verifyWebhookSignature(rawBody, header)` — all reusing the existing HMAC canonical-string signer.
- `src/lib/flashtopup.functions.ts`: add `syncFlashtopupServices` (admin), `mapSupplierService` (admin), `pollSupplierOrders` (admin), and public `verifyPlayerId` (rate-limited, no credentials exposed, only nickname returned).
- `src/lib/flashtopup-fulfil.server.ts`: `fulfilOrder(orderCode)` — resolves the mapped service, reuses/creates `supplier_orders` row keyed by `reference_id`, calls create-order, records the response. Called from `verifyRazorpayPayment` and from admin order approval.
- `src/routes/api/public/flashtopup/webhook.ts`: raw-body read, timing-safe HMAC compare, `event_id` dedupe insert, status mapping, order update, 200.

**Frontend**

- Supplier Catalog: expandable rows with a services table, "Sync Services" button, per-service catalog mapping select.
- Product/checkout page: player-ID verify control with nickname display and gated pay button when the mapped service requires validation.
- Order page: supplier status and delivery details section.
