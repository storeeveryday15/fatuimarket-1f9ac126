# Fix Auth Email: Send 6-Digit OTP Instead of Magic Link

## Current state
- The login page (`/auth`) uses `supabase.auth.signInWithOtp` and expects a 6-digit code.
- Supabase is still sending the default Magic Link email with a "Log In" button (`{{ .ConfirmationURL }}`).
- No custom email domain is configured yet, so Lovable Cloud is using default auth templates.

## Goal
Replace the Magic Link email with an OTP email that shows the 6-digit code (`{{ .Token }}`) and matches Fatui Market branding.

## Steps

1. **Configure a sender domain**
   - Required: a real domain you own (e.g., `mail.fatuimarket.shop` or `notify.fatuimarket.shop`).
   - Use the Lovable Cloud email setup dialog to delegate the subdomain and verify DNS.
   - This unlocks custom auth email templates.

2. **Scaffold custom auth email templates**
   - Generate the 6 Lovable auth templates (signup, magic-link, recovery, invite, email-change, reauthentication).
   - This creates the edge function and React Email templates in the project.

3. **Customize the Magic Link template for OTP**
   - Replace `{{ .ConfirmationURL }}` and the "Log In" button with `{{ .Token }}` displayed as the 6-digit code.
   - Update subject line to "Your Fatui Market login code is {{ .Token }}".
   - Apply Fatui Market brand styling (colors, logo).

4. **Deploy the auth email hook**
   - Deploy the `auth-email-hook` edge function so Supabase routes auth emails through the custom templates.

5. **Verify the end-to-end flow**
   - Send a test OTP from `/auth`.
   - Confirm the email contains the 6-digit code.
   - Confirm the code is accepted on the verification page.

## Outcome
Users will receive a 6-digit OTP email instead of a magic link, matching the current UI flow.
