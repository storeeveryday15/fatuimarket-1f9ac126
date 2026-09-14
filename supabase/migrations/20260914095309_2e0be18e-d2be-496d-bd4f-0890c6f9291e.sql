CREATE TABLE public.payment_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL DEFAULT 'fatui_pay',
  event_id text NOT NULL,
  event_type text,
  order_code text,
  payment_reference text,
  status text NOT NULL DEFAULT 'received',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

GRANT ALL ON public.payment_webhook_events TO service_role;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read payment webhook events" ON public.payment_webhook_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));