## Fix Live Visitor Stats + Email OTP (not magic link)

### 1. Live Visitor Stats always 0

Root cause: a recent security migration reverted `get_visitor_stats` to `SECURITY DEFINER` and revoked `EXECUTE` from `anon`. Guests (the majority of homepage viewers) get an empty response, so the widget shows 0/0/0. The `site_visitors` INSERT/UPDATE policies also require `last_seen_at` within a ±30s window, which is fine, but guests can't read the aggregates back.

Fix (single migration):
- `GRANT EXECUTE ON FUNCTION public.get_visitor_stats() TO anon;` so the public counter works for logged-out users too.
- Keep `get_order_stats` / `get_leaderboard` authenticated-only (unchanged) — those aren't the widget.
- Verify the heartbeat upsert path works for anon (RLS already allows it with a valid `session_id` and fresh timestamp — the client already sends both).
- No component changes needed; `LiveVisitors` already polls + subscribes to Realtime on `site_visitors`.

### 2. Supabase is still sending magic-link emails instead of a 6-digit code

Root cause: the code calls `supabase.auth.signInWithOtp` correctly, but the Supabase Auth **email template** for "Magic Link" still uses `{{ .ConfirmationURL }}`. When the template contains a confirmation URL, Supabase sends the link version; to send just the numeric code, the template must reference `{{ .Token }}` (and no URL).

Fix: scaffold Lovable-managed auth email templates so the "Magic Link / OTP" email renders only the 6-digit `{{ .Token }}` with no login button. This uses `email_domain--scaffold_auth_email_templates`, then brand the template to match the dark purple Fatui Market theme. Also confirms the OTP expiry is 10 minutes (Supabase default for email OTP is 3600s; we'll set it to 600s via `configure_auth` if the tool exposes it, otherwise document that the code already expires in the OTP's TTL window and note the setting).

No code changes to `src/routes/auth.tsx` — the flow already:
- calls `signInWithOtp({ email, options: { shouldCreateUser: true } })`
- shows the 6-slot OTP input and verifies via `verifyOtp({ type: "email", token })`
- keeps Google sign-in above the email form

### Technical steps
1. Migration: `GRANT EXECUTE ON FUNCTION public.get_visitor_stats() TO anon;`
2. Check email domain status; if a domain exists, scaffold auth email templates and brand the magic-link/OTP template to show only `{{ .Token }}`. If no domain exists, prompt the user to set one up (required for Lovable-managed auth emails that omit the confirmation URL).
3. Verify in preview: guest opens homepage → header chip shows a non-zero online count; requesting an email code delivers a 6-digit numeric code with no clickable link.

### Note
Removing the confirmation URL from the auth email requires a configured email sender domain in Lovable Cloud. If you don't have one yet, I'll walk you through the one-click setup dialog as part of step 2.