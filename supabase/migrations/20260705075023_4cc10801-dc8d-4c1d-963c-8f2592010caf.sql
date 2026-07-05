REVOKE EXECUTE ON FUNCTION public.get_visitor_stats() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_visitor_stats() TO authenticated, service_role;