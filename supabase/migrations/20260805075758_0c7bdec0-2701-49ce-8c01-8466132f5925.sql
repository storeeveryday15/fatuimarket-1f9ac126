CREATE TABLE public.email_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  announcement_id uuid REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid,
  email text NOT NULL,
  message_id text,
  template_name text NOT NULL DEFAULT 'announcement',
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_email_recipients_announcement ON public.email_recipients(announcement_id);
CREATE INDEX idx_email_recipients_email ON public.email_recipients(lower(email));

GRANT SELECT ON public.email_recipients TO authenticated;
GRANT ALL ON public.email_recipients TO service_role;
ALTER TABLE public.email_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read email recipients" ON public.email_recipients
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER email_recipients_touch BEFORE UPDATE ON public.email_recipients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_token text,
  announcement_id uuid REFERENCES public.announcements(id) ON DELETE CASCADE,
  email text,
  event text NOT NULL,
  url text,
  user_agent text,
  device text,
  client text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_email_events_announcement ON public.email_events(announcement_id);
CREATE INDEX idx_email_events_token ON public.email_events(recipient_token);
CREATE INDEX idx_email_events_created ON public.email_events(created_at DESC);

GRANT SELECT ON public.email_events TO authenticated;
GRANT ALL ON public.email_events TO service_role;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read email events" ON public.email_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));