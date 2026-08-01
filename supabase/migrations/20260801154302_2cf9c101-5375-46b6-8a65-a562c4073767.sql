ALTER TABLE public.site_visitors
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS referrer text;

CREATE OR REPLACE FUNCTION public.visitor_heartbeat(
  _session_id text,
  _device_type text DEFAULT NULL,
  _referrer text DEFAULT NULL,
  _country text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _session_id IS NULL OR length(_session_id) < 8 OR length(_session_id) > 64 THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  INSERT INTO public.site_visitors (session_id, first_seen_at, last_seen_at, user_id, device_type, referrer, country)
  VALUES (
    _session_id, now(), now(), auth.uid(),
    nullif(left(coalesce(_device_type,''), 16), ''),
    nullif(left(coalesce(_referrer,''), 200), ''),
    nullif(left(coalesce(_country,''), 8), '')
  )
  ON CONFLICT (session_id) DO UPDATE
    SET last_seen_at = now(),
        user_id = COALESCE(auth.uid(), public.site_visitors.user_id),
        device_type = COALESCE(EXCLUDED.device_type, public.site_visitors.device_type),
        referrer = COALESCE(public.site_visitors.referrer, EXCLUDED.referrer),
        country = COALESCE(EXCLUDED.country, public.site_visitors.country);
END;
$$;

REVOKE ALL ON FUNCTION public.visitor_heartbeat(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.visitor_heartbeat(text, text, text, text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_visitor_stats();

CREATE OR REPLACE FUNCTION public.get_visitor_stats(_tz_offset_minutes integer DEFAULT 0)
RETURNS TABLE(online integer, today integer, total integer, desktop integer, mobile integer, tablet integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    count(*) FILTER (WHERE last_seen_at > now() - interval '60 seconds')::int,
    count(*) FILTER (WHERE (first_seen_at + make_interval(mins => _tz_offset_minutes))::date
                          = (now() + make_interval(mins => _tz_offset_minutes))::date)::int,
    count(*)::int,
    count(*) FILTER (WHERE device_type = 'desktop')::int,
    count(*) FILTER (WHERE device_type = 'mobile')::int,
    count(*) FILTER (WHERE device_type = 'tablet')::int
  FROM public.site_visitors;
$$;

REVOKE ALL ON FUNCTION public.get_visitor_stats(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_visitor_stats(integer) TO anon, authenticated;