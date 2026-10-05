ALTER TABLE public.supplier_orders
  ADD COLUMN supplier_key TEXT NOT NULL DEFAULT 'flashtopup';

ALTER TABLE public.supplier_webhook_events
  ADD COLUMN supplier_key TEXT NOT NULL DEFAULT 'flashtopup';

ALTER TABLE public.supplier_webhook_events
  DROP CONSTRAINT supplier_webhook_events_event_id_key;

ALTER TABLE public.supplier_webhook_events
  ADD CONSTRAINT supplier_webhook_events_supplier_key_event_id_key
  UNIQUE (supplier_key, event_id);

CREATE INDEX supplier_orders_supplier_key_idx
  ON public.supplier_orders (supplier_key);

CREATE INDEX supplier_webhook_events_supplier_key_idx
  ON public.supplier_webhook_events (supplier_key);

COMMENT ON COLUMN public.supplier_orders.supplier_key IS
  'Stable server-resolved provider identifier for this fulfilment attempt.';

COMMENT ON COLUMN public.supplier_webhook_events.supplier_key IS
  'Stable provider identifier used with event_id for provider-scoped webhook idempotency.';