ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS email_sent_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_failed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_error text,
  ADD COLUMN IF NOT EXISTS inapp_count integer NOT NULL DEFAULT 0;