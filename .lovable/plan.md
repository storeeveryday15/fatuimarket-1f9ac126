# Dynamic FlashTopup Catalog for Fatui Market

Goal: FlashTopup becomes the single source of truth for games and packages. No hand-created
products. New supplier games appear after a sync; removed ones are disabled automatically.

Nothing in the existing store is rebuilt: accounts, wallet, orders, Razorpay, admin panel,
theme, header/footer and support stay exactly as they are.

## What ships

### 1. Sync engine (server-side only)
- Extend the existing signed client to page through `/products` until the catalog is complete
  (detects `page`/`per_page`/`next` style envelopes; stops safely if the API is not paginated).
- Sync writes to the existing `supplier_products` / `supplier_services` tables and records a
  run row: started, finished, counts added/updated/disabled, error text.
- Products/services the API no longer returns get `active = false` — never deleted, so past
  orders keep their history.
- A scheduled job runs the full sync periodically (catalog + prices + availability). Customer
  pages never call FlashTopup; they read our database.

### 2. Catalog metadata (new columns)
On `supplier_products`: `slug` (auto-generated from name, de-duplicated with the product code),
`region`, `category`, `display_name` override, `enabled`, `featured`, `hidden`.
On `supplier_services`: `available` flag from the API stock/availability field.
Regional titles stay separate products — Valorant PH and Valorant SG never merge.

### 3. Markup / pricing rules
New `pricing_rules` table: scope (global / category / product), type (percent or fixed), value,
priority. Selling price is computed from the supplier price at read time, so a supplier price
change flows through after the next sync without overwriting anything.
- Admin sees supplier cost, selling price and profit.
- Customers only ever receive the selling price — enforced by a public view that does not
  expose cost columns, matching the existing `catalog_products` protection.

### 4. Storefront
- `/games` — full catalog grid: search across game name, region and package name, category
  filters, featured row, unavailable items greyed out and non-purchasable.
- `/games/$slug` — dynamic game page listing that game's live packages with price,
  availability and any package description, plus the required player/server inputs the API
  reports for that service.
- Existing hand-built pages and homepage rails stay live; the new catalog is added alongside
  them so nothing currently working disappears.

### 5. Order flow
Package -> player inputs -> Check-ID validation (when the service requires it) -> final price
-> payment -> supplier order. Payment success alone never marks an order completed; the order
reaches Completed only when FlashTopup reports success via webhook or status poll. Failure
surfaces as Failed with the supplier reason, and refund/wallet behaviour follows existing rules.

### 6. Admin: API Catalog section
Totals (games, active, unavailable), last sync time, last error, and buttons for
Sync Now / Refresh Prices / Refresh Stock. Per game: enable/disable, markup override, display
name, category, feature, hide. Supplier product code and validation code are read-only.

### 7. Resilience
Sync failures never break the store — the last successful catalog stays served. Errors are
logged server-side and shown in admin only; customers see a generic message. All supplier
calls remain server-side with credentials in environment secrets.

## Technical notes
- Endpoint/field names come from a live probe of `/products` and `/services` responses before
  the mapping code is written; nothing is invented. If the API turns out not to paginate, the
  pager degrades to a single request.
- New server functions live in `src/lib/flashtopup-catalog.functions.ts`; supplier calls stay in
  `*.server.ts` helpers loaded inside handlers.
- Public catalog reads go through a publishable-key server function plus a narrow anon SELECT
  policy on the safe view.
- Scheduled sync uses pg_cron calling a `/api/public/*` route authenticated with the anon key.

## Rollout order
1. Probe the live API shapes and add pagination + sync-run logging.
2. Migration: metadata columns, pricing rules, safe public view, grants and policies.
3. Admin API Catalog page.
4. Public `/games` catalog and `/games/$slug` pages.
5. Wire the new pages into the existing checkout and fulfilment flow.
