## Goal

Turn Fatui Market into a full reseller operations platform: supplier management, cost/profit tracking, a smart price engine, an AI admin assistant, live notifications, and analytics — all on real database tables with realtime updates and admin-only access.

This is far too large for one pass, so it ships in 4 phases. Each phase is usable on its own.

---

### Phase 1 — Data foundation + Supplier management

New tables (admin-only access, all realtime-enabled):

- `suppliers` — name, website, api_endpoint, api_key_ref, status, priority, supported products, notes, auto_pricing_enabled, auto_ordering_enabled, last_checked_at, avg_response_ms, error_count
- `catalog_products` — the sellable SKUs (product slug, tier, category, images, description, selling price, supplier cost, supplier link, visibility, featured, stock status, auto_pricing)
- `price_history` — supplier price, selling price, profit, reason, AI explanation, changed_by, timestamp
- `notifications` — type, severity, title, body, read, created_at
- `admin_audit_log` — actor, action, target, payload, timestamp
- `platform_settings` — min profit, max profit, rounding rule, auto-pricing mode, alert thresholds, AI behaviour
- `supplier_checks` — status, response time, error message per check

The 12 suppliers you listed are seeded with their URLs, marked "manual pricing" since none expose a public reseller API.

**Supplier page** (`/admin/suppliers`): list with live status chips (Online / Offline / Slow / API Error / Auth Error), last checked, avg response, error count; create/edit drawer with all fields; API keys stored as backend secrets, never in a table column.

### Phase 2 — Smart Price Engine + Product management

- Product manager (`/admin/products`): images, description, supplier link, category, selling price, supplier cost, live profit + margin %, visibility, featured, stock, auto-pricing toggle.
- Price engine computes Recommended Price from min/max profit rules, rounding, and a hard "never below cost" floor.
- Modes: Manual / Suggest Only / Automatic. In Automatic, a scheduled job applies changes and writes `price_history` with old price, new price, reason, timestamp, AI explanation. One-click rollback per entry.
- Price history timeline + charts per product (supplier price vs selling price vs profit).

### Phase 3 — Admin dashboard, notifications, analytics

- Dashboard cards: today's revenue/profit, weekly, monthly, orders today, pending/completed/cancelled, AOV, top sellers, most profitable, low margin, customer growth, supplier status, wallet balance, system health — all live via realtime subscriptions, with loading skeletons and animated cards.
- Notification center: bell with unread count, severity filter, search, mark-read, triggered on price change, supplier offline, low wallet, failed order, new order, new customer, low profit, API error, system warning. Email + Telegram fanout reuses your existing notification wiring; Discord webhook added as an optional setting.
- Analytics page: revenue, profit, margins, supplier performance, best/worst sellers, sales by category, over day/week/month/year, with charts.
- Customer management: profiles, order history, lifetime value, favourite products, VIP level, ban toggle.

### Phase 4 — AI layer

- **AI Admin Assistant** (admin-only chat): answers questions on orders, revenue, products, customers and profit by querying the database through tools; analyses trends, recommends pricing, flags unusual activity, generates reports, explains margins, suggests improvements.
- **Daily AI report** (cron): sales summary, profit summary, recommended prices, supplier changes, products needing attention, opportunities, customer insights — stored and shown in the dashboard.
- **AI customer support** upgrade to the existing chat widget: FAQs, order status lookup, product recommendations, Fatui Market wallet balance, ticket creation, escalation to admin.

---

### Technical notes

- Supabase tables with RLS: every new table is admin-only via the existing `has_role(auth.uid(),'admin')`, with explicit GRANTs; customer-facing reads (catalog) get a narrow public policy.
- Realtime: tables added to the realtime publication; subscriptions live in hooks with proper cleanup.
- Server logic uses TanStack server functions; scheduled work uses pg_cron calling public API routes with key auth.
- No scraping. Suppliers without an official API are manual-update only; the "check" job only records reachability where the site permits it, otherwise status stays admin-set.
- AI uses the built-in Lovable AI gateway (no extra API key), with all prompts and tool execution server-side.
- Existing storefront UI is untouched; all new surfaces live under `/admin/*`.

### Scope check

Migrating your current hardcoded `src/lib/products.ts` catalog into the `catalog_products` table is part of Phase 2 — after that, the storefront reads prices from the database so auto-pricing actually affects what customers see.
