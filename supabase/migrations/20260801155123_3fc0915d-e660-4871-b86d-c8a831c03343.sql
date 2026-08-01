GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_stats() TO anon, authenticated;
GRANT SELECT ON public.reviews_public TO anon, authenticated;