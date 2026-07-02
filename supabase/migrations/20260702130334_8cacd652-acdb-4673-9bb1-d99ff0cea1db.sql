-- Remove anon SELECT policy on orders; anon reads live orders through the public_orders_feed view (safe columns only).
DROP POLICY IF EXISTS "orders ticker view base read" ON public.orders;
-- Ensure no table-wide or column-level SELECT grants exist for anon on orders.
REVOKE ALL ON public.orders FROM anon;