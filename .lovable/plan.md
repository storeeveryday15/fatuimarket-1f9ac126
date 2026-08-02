# Branded 6-Digit OTP Auth Emails

Sender domain `notify.fatuimarket.shop` is configured and email infrastructure is in place, so the remaining work is templates + verification.

## What will be built

1. **Generate the six auth email templates** (signup, magic link, recovery, invite, email change, reauthentication) plus the auth email webhook route for this project.

2. **Rewrite the magic-link template as an OTP email**
   - Show the 6-digit code (`{{ .Token }}`) in a large, spaced, easy-to-copy block.
   - Remove the "Log In" button and the confirmation URL entirely.
   - Subject: "Your Fatui Market login code is {{ .Token }}".
   - Add expiry note ("expires in 10 minutes") and a "didn't request this?" line.

3. **Apply Fatui Market branding to all templates**
   - Purple/magenta accent matching the site's primary gradient, dark accent header, white email body (required for inbox compatibility).
   - Fatui Market wordmark, footer with store link and support contact.
   - The signup/confirmation template also gets a code-first layout so new-user sign-in matches the OTP screen.

4. **Deploy the auth email hook** so authentication emails route through these templates.

5. **Verify end-to-end**: trigger a sign-in from `/auth`, confirm the email delivers a 6-digit code (not a login link), and confirm the code is accepted by the existing verification screen.

## Technical notes

- Templates are React Email components; the magic-link template drops `{{ .ConfirmationURL }}` in favor of `{{ .Token }}`, which is what `supabase.auth.verifyOtp({ type: "email" })` on `/auth` already expects.
- No changes to `src/routes/auth.tsx` — the existing OTP UI stays as is.
- If DNS for `notify.fatuimarket.shop` is still verifying, templates are installed immediately and start sending once verification completes; delivery status is visible in Cloud → Emails.
