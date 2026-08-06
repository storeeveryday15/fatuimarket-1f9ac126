# FlashTopup Products API Integration

Pull the FlashTopup reseller product list into your backend on demand, store it, and browse it from a new admin page — with the API key never leaving the server.

## What you get

- A new admin page **Supplier Catalog** (`/admin/supplier-catalog`) listing every FlashTopup product with: name, product code, product type, icon, and validation code.
- A **Sync Products** button that refetches the live list, updates existing rows, adds new ones, and marks removed ones inactive. Shows last-synced time and a result summary (added / updated / removed).
- Search + type filter over the synced list.
- A "Mapped to" column with a per-row selector so you can later link a FlashTopup product to one of your storefront catalog products (mapping is stored, not yet used for pricing/ordering).

## Credentials

Two secrets stored securely on the server: `FLASHTOPUP_API_ID` and `FLASHTOPUP_API_KEY`. They are only read inside the server handler; nothing is exposed to the browser.

## Technical details

**Database (migration)**
- New table `public.supplier_products`: `supplier_key` (default `flashtopup`), `product_code` (unique with supplier_key), `name`, `product_type`, `icon_url`, `validation_code`, `raw` jsonb, `active`, `catalog_product_id` (nullable FK to `catalog_products`), timestamps.
- Grants: `SELECT/INSERT/UPDATE/DELETE` to `authenticated`, `ALL` to `service_role`, no `anon`.
- RLS on; policies restrict all access to admins via `has_role(auth.uid(), 'admin')`.
- `touch_updated_at` trigger.
- New row in `app_config` style tracking is not needed; last sync is derived from `max(updated_at)`.

**Backend**
- `src/lib/flashtopup.server.ts`: signed request helper. Builds
  `METHOD\n/api/reseller/v2/<path>\n<unix_ts>\n<nonce>\n<sha256_hex(raw_body)>`
  (empty-body SHA-256 for GET), signs with `HMAC_SHA256(canonical, API_KEY)` via Web Crypto, and sends headers `X-FT-API-ID`, `X-FT-Timestamp`, `X-FT-Nonce`, `X-FT-Signature`, `Content-Type: application/json`. Base URL `https://api.flashtopup.com/api/reseller/v2`.
- `src/lib/flashtopup.functions.ts`:
  - `syncFlashtopupProducts` — `createServerFn` with `requireSupabaseAuth`, verifies caller has the `admin` role, calls `GET /products`, normalizes the response (tolerant field mapping for name/code/type/icon/validation code), upserts into `supplier_products` via the admin client loaded inside the handler, deactivates codes missing from the response, returns counts.
  - `listSupplierProducts` — admin-verified read of the stored rows.
  - `mapSupplierProduct` — admin-verified update of `catalog_product_id`.

**Frontend**
- `src/routes/admin/supplier-catalog.tsx` using existing admin page/table styling, TanStack Query for reads, sync button with loading + toast feedback and error surfacing.
- Nav entry added in `src/components/admin/admin-nav.tsx`.

**Safety**
- No API credentials in client bundles; all calls run server-side.
- Every function checks the admin role before doing work.
- Sync failures return a readable message; provider errors are logged server-side only.
