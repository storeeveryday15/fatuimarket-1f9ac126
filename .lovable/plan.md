## Root cause
`fatuimarket@gmail.com` exists in `auth.users` and is email-confirmed (last successful login 2026-06-17). Supabase returns "Invalid login credentials" only when email or password don't match — this is a wrong-password situation, not a config issue. Signup and login already share the same project, email auth is on, and the auth screen already shows the exact Supabase error message in a toast (line 84 of `src/routes/auth.tsx`).

The actionable fix is a password-reset flow so the user (and future users) can recover.

## Changes

### 1. `src/routes/auth.tsx`
- Add a **"Forgot password?"** link under the password field, visible only in sign-in mode.
- Clicking it switches to a small inline "Reset password" view that:
  - Takes an email
  - Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${window.location.origin}/reset-password\` })`
  - Shows success toast: "Check your email for a reset link"
  - Surfaces any Supabase error verbatim in a toast
- Add a "Back to sign in" link from that view.
- Keep the existing exact-error toast for sign-in/sign-up (already present).

### 2. New `src/routes/reset-password.tsx` (public route)
- Public route (NOT under `_authenticated/`) so the recovery link works.
- On mount, Supabase's recovery link puts a session in the URL hash; the existing client auto-detects it. We verify with `supabase.auth.getUser()`; if no user, show "Reset link expired — request a new one" with a link back to `/auth`.
- Form: new password + confirm password (min 6 chars, must match).
- Submit calls `supabase.auth.updateUser({ password })`. On success, toast and redirect to `/`.
- Shows the exact Supabase error in a toast on failure.
- `head()` with title "Reset password — Fatui Market".

### 3. No DB or backend changes
- No migration needed.
- No changes to admin email, secrets, or notifications.

## Out of scope
- Email branding for the reset email (uses default Supabase template until you set up custom auth emails).
- Rate limiting beyond Supabase's built-in.

## Files
- Edited: `src/routes/auth.tsx`
- New: `src/routes/reset-password.tsx`
