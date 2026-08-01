# Fatui AI Assistant, Announcements & Smart Notifications

A large build, split into four shippable phases. Each phase works on its own, so we can stop or reorder after any of them.

## Phase 1 — Fatui AI Assistant (site-wide)

A customer-facing assistant reachable from every page, added as a new panel in the existing orbital floating menu (the "Live Chat" slot).

- Single conversation, kept in the browser only (no login required, no chat history database). Cleared with a "New chat" button.
- Streams answers from Lovable AI (Gemini 3.6 Flash) through a server route, so no keys ever reach the browser.
- Knowledge the assistant is given on every request:
  - Store policy pack: how ordering works, delivery times, refunds, payment methods (UPI/card/netbanking/wallet), coupons, wallet top-ups, order tracking, login, support channels, business hours, international payments, pricing changes, safety.
  - Live catalog: product names, tiers, public prices, stock status, and per-game server/region lists, read from the database at request time so answers never go stale.
  - Per-game guides: required account details (e.g. MLBB Zone + Server ID vs Genshin UID + region), recharge steps, delivery expectations, common issues.
  - Latest cached game news (Phase 2).
- Safety: the server prompt is built only from public data. Supplier costs, admin notes, secrets, other customers' data, and internal tables are never queried on this path.
- Order lookup: if a signed-in customer asks about their order, the assistant can look up only that customer's own orders.

## Phase 2 — Game news system

- `game_news` table: game slug, category (event, banner, skin, hero, patch, codes, pass), title, summary, source URL, published date.
- A scheduled job refreshes news every 6 hours from official sources, summarises with AI, and stores the results. Nothing is fetched on page load — pages read the cached rows.
- Powers both the assistant's "what's new in X" answers and the Smart Notifications in Phase 4.
- A small "Latest in <game>" strip on each product page.

## Phase 3 — Announcement Center + Notification Inbox

Admin side (new `/admin/announcements` page):

- Create announcements of type text, image, banner, emergency, maintenance, coupon, flash sale, event.
- Fields: title, description, image upload, button text, button link, target games, start date, end date, priority, status (draft/published), plus a live preview.
- Homepage banner slider becomes database-driven: unlimited banners with image, title, subtitle, button, schedule, priority and target game — replacing today's hardcoded slides.

Customer side:

- Announcements render on the homepage, on matching product pages, and in the dashboard, filtered by date window, priority and target game.
- Notification Center inbox at `/notifications` with categories Orders, Events, Sales, Maintenance, Coupons, System, and an unread badge in the header.
- Order status changes automatically create inbox entries.

## Phase 4 — Smart notifications & preferences

- Each customer's purchased games are derived from their order history; promotional notifications only go to customers who bought that game.
- Frequency caps: at most 1 promotional email per customer per month; order emails and emergency announcements are uncapped.
- Account Settings gains toggles for Email, Push notifications and Store announcements; every send checks them.
- Email sending uses the project's email infrastructure; if no sender domain is set up yet, in-app inbox notifications ship first and email switches on once the domain is verified.

## Technical notes

- New tables: `game_news`, `announcements`, `banners`, `notifications`, `notification_preferences`. All with row-level security: customers read only their own inbox rows and published announcements; only admins write.
- Images for announcements/banners go to a public storage bucket with admin-only writes.
- Assistant and news refresh run as TanStack server functions / server routes; the news refresh is triggered on a schedule.
- The assistant's system prompt is assembled server-side from a public-data query only, and product cost/supplier columns are excluded at the query level, not just by prompt instruction.

## Suggested order

Phase 1 first (biggest customer-visible win), then 3, then 2, then 4 — since smart notifications depend on both the news feed and the inbox.
