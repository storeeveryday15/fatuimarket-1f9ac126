## Customer Review System

### Database (new migration)
New table `public.reviews`:
- `id` uuid PK, `user_id` uuid (nullable, FK to auth.users), `product_slug` text (nullable — null = site-wide review)
- `full_name` text (private, server-only)
- `display_name` text (generated/stored: first name + first initial of last name, e.g. "Rahul S.")
- `rating` int (1–5, validated)
- `review` text (max 1000 chars)
- `status` text default `'approved'` (`approved` | `pending` | `rejected`) — admin can moderate
- `created_at`, `updated_at`

GRANTs + RLS:
- `GRANT SELECT` to `anon` and `authenticated` — but only via a column-safe approach: create a **view** `public.reviews_public` that selects only `id, display_name, rating, review, product_slug, created_at` (never `full_name` or `user_id`). Grant SELECT on the view to `anon`/`authenticated`. Keep base table SELECT restricted to admins + owner.
- INSERT policy on base table: `authenticated` can insert their own row (`user_id = auth.uid()`).
- UPDATE/DELETE: owner can edit/delete own; admin can do all (via `has_role`).
- Trigger `before insert/update`: compute `display_name` from `full_name` server-side so client cannot spoof it. Logic: split on whitespace → `first + ' ' + upper(left(last,1)) + '.'`; if single name, just `first`.

### Frontend
1. **`src/components/review-form.tsx`** — Form (full name, rating stars 1–5, review textarea) using react-hook-form + zod. Requires sign-in; shows "Sign in to leave a review" CTA otherwise. Submits to `reviews` table via browser supabase client.
2. **`src/components/reviews-list.tsx`** — Reads from `reviews_public` view, shows display_name, star rating, review text, date. Supports optional `productSlug` prop to filter.
3. **Integration**:
   - `src/routes/products.$slug.tsx` — add reviews section (list + form) per product.
   - `src/routes/index.tsx` — add a "What customers say" section showing latest approved site-wide reviews.
4. **Admin** — add "Reviews" tab to `src/routes/admin.tsx`: table of all reviews (incl. full_name visible to admin only), with Approve/Reject/Delete actions and search by name.

### Privacy guarantee
`full_name` never leaves the server for public consumers — public reads go through the `reviews_public` view which omits the column entirely. Only the admin tab (RLS-gated by `has_role('admin')`) sees full names.

### Out of scope
- Photo uploads in reviews
- Verified-purchase badge
- Helpful/unhelpful voting
- Email notifications on new reviews (can add later if wanted)

### Files
- New migration: `supabase/migrations/<ts>_reviews.sql`
- New: `src/components/review-form.tsx`, `src/components/reviews-list.tsx`
- Edited: `src/routes/products.$slug.tsx`, `src/routes/index.tsx`, `src/routes/admin.tsx`
- Regenerated: `src/integrations/supabase/types.ts`
