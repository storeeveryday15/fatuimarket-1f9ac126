# Announcement emails: personalization, analytics, branded footer, image upload

## 1. Personalization variables (not supported today — will be added)

The editor currently sends the message text as-is. I'll add placeholder replacement at send time, per recipient:

- `{{first_name}}` — first word of the customer's display name
- `{{customer_name}}` — full display name
- `{{username}}`
- `{{email}}`
- `{{favorite_game}}` — most-ordered game for that customer (falls back to a neutral word)
- `{{wallet_balance}}` — formatted INR balance
- `{{store_name}}` / `{{store_url}}`

Rules: unknown placeholders are left untouched; empty values fall back to a safe default ("there" for names). The composer gets a small chip list to insert placeholders, plus a live preview using your own account's data. Placeholders work in title and body, for both email and in-app notifications.

## 2. Email analytics

Important: the sending provider only reports bounces, spam complaints and unsubscribes back to this app. It does **not** report delivery receipts, inbox vs promotions placement, opens or clicks. So:

- **Measured by the provider (real-time webhook):** Bounced, Spam complaints, Unsubscribed.
- **Measured by us (first-party tracking added in this change):** Opened, Open rate, Link clicks, CTR, opens/clicks over time, top clicked links, device split, email client, country.
- **Marked "Not available" (never estimated):** Delivered receipts, Inbox placement, Promotions placement. These will render as a greyed "Unavailable — not reported by the sending provider" state.

How first-party tracking works:
- Each email gets a unique recipient token. The template embeds a 1x1 tracking pixel and rewrites every link through a redirect endpoint.
- Public endpoints record the event with user-agent (device + email client) and country header, then serve the pixel / redirect.
- Opens are best-effort: recipients who block images won't be counted; the dashboard labels this.

Campaign dashboard (new tab under Admin → Notifications): stat cards for Sent / Delivered (unavailable) / Inbox (unavailable) / Promotions (unavailable) / Opened / Open rate / Clicks / CTR / Bounced / Unsubscribed / Complaints, plus charts (Recharts, same style as Admin → Analytics):
- Opens over time, Clicks over time (line)
- Top clicked links (bar)
- Device split Mobile/Desktop (donut)
- Email client Gmail/Outlook/Apple Mail/Other (donut)
- Country breakdown (bar, when the header is present)

Customer timeline: per-recipient list showing Sent → Delivered/Bounced → Opened → Clicked → Unsubscribed with timestamps, searchable by email, opened from any campaign row. All views update live via realtime subscriptions.

## 3. Permanent branded footer

Added to the email template itself so it appears on every announcement without pasting anything:

```text
—
You're receiving this email because you're a Fatui Market customer.
Manage notification preferences or unsubscribe anytime.
🌐 fatuimarket.shop   📧 fatuimarket@gmail.com
[WhatsApp] [Instagram] [Telegram] [Facebook] [YouTube]
© 2026 Fatui Market. All rights reserved.
```

Social icons are pulled from the Official links you already manage in Admin → Settings, so editing a link there updates future emails. Icons are hosted images (email clients don't render inline SVG reliably). "Unsubscribe" uses the existing one-click token, "manage preferences" points at the dashboard.

## 4. Banner image upload

The banner field becomes an upload control with drag-and-drop plus a phone camera/gallery picker, keeping URL paste as an option. Files go to the existing announcements storage bucket (made publicly readable, since email clients must fetch the image without a session), admin-only writes, 8 MB limit, image types only, client-side downscale to max 1200px wide before upload. Shows a live preview and a remove button.

## Technical notes

- New tables: `email_events` (message_id, announcement_id, recipient token/email, event type, user-agent, device, client, country, url, created_at) and `email_recipients` (per-send token, announcement, user, email, status). RLS: admin-only reads; writes only through security-definer functions called by the public tracking endpoints. GRANTs included.
- New public routes: `src/routes/api/public/e/o.$token.ts` (pixel) and `src/routes/api/public/e/c.$token.ts` (click redirect, validates the target against an allowlist of our own + known social domains to avoid an open redirect).
- `src/lib/admin-messaging.functions.ts`: per-recipient personalization, recipient token creation, link rewriting, footer data.
- `src/lib/email-templates/announcement.tsx` + `brand.tsx`: footer block, tracking pixel.
- `src/routes/lovable/email/suppression.ts`: also write bounce/complaint/unsubscribe into `email_events`.
- New `src/components/admin/campaign-analytics.tsx` and a "Analytics" tab in `src/routes/admin/notifications.tsx`.
- Storage bucket `announcements` switched to public read; upload helper in the composer.
