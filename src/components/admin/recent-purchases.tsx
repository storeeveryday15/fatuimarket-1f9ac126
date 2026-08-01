import { getProduct } from "@/lib/products";
import { inr, maskName, timeAgo, type MetricOrder } from "@/hooks/use-admin-metrics";

/** Latest completed purchases — live, with masked customer names. */
export function RecentPurchases({ orders }: { orders: MetricOrder[] }) {
  const rows = orders
    .filter((o) => o.status === "completed" || o.status === "delivered")
    .slice(0, 12);

  return (
    <div className="surface-card mt-6 p-4">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        <h3 className="text-sm font-bold uppercase tracking-wider">Recent purchases</h3>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No completed purchases yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((o) => {
            const product = getProduct(o.product_slug);
            return (
              <li key={o.id} className="flex items-center gap-3 py-2.5">
                {product?.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    width={40}
                    height={40}
                    loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-secondary" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {maskName(o.player_name ?? o.customer_email)}{" "}
                    <span className="font-normal text-muted-foreground">purchased</span> {o.tier_label}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {product?.name ?? o.product_name} · {timeAgo(o.completed_at ?? o.created_at)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold tabular-nums">{inr(Number(o.amount_inr) || 0)}</div>
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-success">
                    {o.status}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
