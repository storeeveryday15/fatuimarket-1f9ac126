import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw, Search, PackageSearch, ChevronDown, ChevronRight, Layers } from "lucide-react";
import {
  listSupplierProducts,
  syncFlashtopupProducts,
  mapSupplierProduct,
  listSupplierServices,
  syncFlashtopupServices,
  mapSupplierService,
} from "@/lib/flashtopup.functions";
import { useAdminProducts } from "@/hooks/use-admin-products";
import { CheckIdTester } from "@/components/admin/check-id-tester";
import { ServiceSyncTester } from "@/components/admin/service-sync-tester";


export const Route = createFileRoute("/admin/supplier-catalog")({
  component: SupplierCatalogPage,
  head: () => ({
    meta: [
      { title: "Supplier Catalog — Fatui Market Admin" },
      { name: "description", content: "Sync and browse the FlashTopup supplier product catalog." },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: () => (
    <div className="surface-card p-8 text-center text-sm text-muted-foreground">
      Could not load the supplier catalog. Please refresh.
    </div>
  ),
});

const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

function SupplierCatalogPage() {
  const qc = useQueryClient();
  const list = useServerFn(listSupplierProducts);
  const sync = useServerFn(syncFlashtopupProducts);
  const mapFn = useServerFn(mapSupplierProduct);
  const listServices = useServerFn(listSupplierServices);
  const syncServices = useServerFn(syncFlashtopupServices);
  const mapServiceFn = useServerFn(mapSupplierService);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { rows: catalog } = useAdminProducts();

  const [q, setQ] = useState("");
  const [type, setType] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["supplier-products"],
    queryFn: () => list(),
  });

  const { data: services } = useQuery({
    queryKey: ["supplier-services"],
    queryFn: () => listServices(),
  });

  const servicesByProduct = useMemo(() => {
    const map = new Map<string, NonNullable<typeof services>>();
    for (const svc of services ?? []) {
      const list = map.get(svc.supplier_product_id) ?? [];
      list.push(svc);
      map.set(svc.supplier_product_id, list as NonNullable<typeof services>);
    }
    return map;
  }, [services]);

  const servicesSync = useMutation({
    mutationFn: () => syncServices({ data: undefined as never }),
    onSuccess: (res) => {
      toast.success(
        `Synced ${res.services} services across ${res.products} products` +
          (res.failed ? ` · ${res.failed} failed` : ""),
      );
      void qc.invalidateQueries({ queryKey: ["supplier-services"] });
    },
    onError: (e: Error) => toast.error(e.message || "Service sync failed"),
  });

  const serviceMap = useMutation({
    mutationFn: (vars: { id: string; catalogProductId: string | null }) => mapServiceFn({ data: vars }),
    onSuccess: () => {
      toast.success("Service mapping saved");
      void qc.invalidateQueries({ queryKey: ["supplier-services"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not save mapping"),
  });

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const syncMutation = useMutation({
    mutationFn: () => sync({ data: undefined as never }),
    onSuccess: (res) => {
      toast.success(
        `Synced ${res.total} products — ${res.added} new, ${res.updated} updated, ${res.removed} removed · ${res.services} services`,
      );
      void qc.invalidateQueries({ queryKey: ["supplier-products"] });
      void qc.invalidateQueries({ queryKey: ["supplier-services"] });
    },
    onError: (e: Error) => toast.error(e.message || "Sync failed"),
  });

  const mapMutation = useMutation({
    mutationFn: (vars: { id: string; catalogProductId: string | null }) => mapFn({ data: vars }),
    onSuccess: () => {
      toast.success("Mapping saved");
      void qc.invalidateQueries({ queryKey: ["supplier-products"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not save mapping"),
  });

  const rows = data ?? [];

  const types = useMemo(() => {
    const set = new Set(rows.map((r) => r.product_type).filter(Boolean) as string[]);
    return [...set].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (type !== "all" && r.product_type !== type) return false;
      if (!query) return true;
      return `${r.name} ${r.product_code} ${r.product_type ?? ""} ${r.validation_code ?? ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [rows, q, type]);

  const lastSync = rows.reduce<string | null>((acc, r) => (!acc || r.updated_at > acc ? r.updated_at : acc), null);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Supplier Catalog</h1>
          <p className="text-sm text-muted-foreground">
            FlashTopup products · {rows.length} stored
            {lastSync ? ` · last synced ${new Date(lastSync).toLocaleString()}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => servicesSync.mutate()}
          disabled={servicesSync.isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:border-foreground/30 disabled:opacity-60"
        >
          <Layers className={`h-4 w-4 ${servicesSync.isPending ? "animate-pulse" : ""}`} />
          {servicesSync.isPending ? "Syncing services…" : "Sync Services"}
        </button>
        <button
          type="button"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          {syncMutation.isPending ? "Syncing…" : "Sync Products"}
        </button>
        </div>
      </div>

      <ServiceSyncTester />

      <CheckIdTester services={services ?? []} />


      <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, product code, validation code…"
            aria-label="Search supplier products"
            className={`${field} pl-9`}
          />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type" className={field}>
          <option value="all">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading supplier products…</p>
      ) : !rows.length ? (
        <div className="surface-card mt-6 p-10 text-center">
          <PackageSearch className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No supplier products yet. Hit “Sync Products” to pull them from FlashTopup.
          </p>
        </div>
      ) : (
        <div className="surface-card mt-6 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-3 w-8" />
                <th className="p-3">Icon</th>
                <th className="p-3">Product</th>
                <th className="p-3">Code</th>
                <th className="p-3">Type</th>
                <th className="p-3">Validation code</th>
                <th className="p-3">Mapped to</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <Fragment key={r.id}>
                <tr className={`border-b border-border/60 ${r.active ? "" : "opacity-50"}`}>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => toggle(r.id)}
                      aria-label={`Show services for ${r.name}`}
                      className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                    >
                      {expanded.has(r.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="p-3">
                    {r.icon_url ? (
                      <img
                        src={r.icon_url}
                        alt=""
                        loading="lazy"
                        width={36}
                        height={36}
                        className="h-9 w-9 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-secondary" />
                    )}
                  </td>
                  <td className="p-3 font-semibold">
                    {r.name}
                    {!r.active && <span className="ml-2 text-[10px] uppercase text-muted-foreground">inactive</span>}
                  </td>
                  <td className="p-3 font-mono text-xs">{r.product_code}</td>
                  <td className="p-3 text-muted-foreground">{r.product_type ?? "—"}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{r.validation_code ?? "—"}</td>
                  <td className="p-3">
                    <select
                      value={r.catalog_product_id ?? ""}
                      onChange={(e) =>
                        mapMutation.mutate({ id: r.id, catalogProductId: e.target.value || null })
                      }
                      aria-label={`Map ${r.name} to a store product`}
                      className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
                    >
                      <option value="">Not mapped</option>
                      {(catalog ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.product_slug} — {p.tier_label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
                {expanded.has(r.id) && (
                  <tr className="border-b border-border/60 bg-background/40">
                    <td colSpan={7} className="p-3">
                      {(servicesByProduct.get(r.id) ?? []).length === 0 ? (
                        <p className="px-2 py-3 text-xs text-muted-foreground">
                          No services synced for this product yet.
                        </p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left uppercase tracking-wider text-muted-foreground">
                              <th className="p-2">Service</th>
                              <th className="p-2">Code</th>
                              <th className="p-2">Price</th>
                              <th className="p-2">Qty</th>
                              <th className="p-2">Inputs</th>
                              <th className="p-2">Mapped to</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(servicesByProduct.get(r.id) ?? []).map((svc) => (
                              <tr key={svc.id} className={svc.active ? "" : "opacity-50"}>
                                <td className="p-2 font-semibold">{svc.service_name}</td>
                                <td className="p-2 font-mono">{svc.service_code}</td>
                                <td className="p-2">
                                  {svc.supplier_price != null ? `${svc.currency ?? ""} ${svc.supplier_price}` : "—"}
                                </td>
                                <td className="p-2">
                                  {svc.min_quantity}–{svc.max_quantity}
                                </td>
                                <td className="p-2 text-muted-foreground">
                                  {svc.input_fields.length ? svc.input_fields.join(", ") : "—"}
                                  {svc.requires_validation && (
                                    <span className="ml-2 rounded bg-[var(--neon)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--neon)]">
                                      verify
                                    </span>
                                  )}
                                </td>
                                <td className="p-2">
                                  <select
                                    value={svc.catalog_product_id ?? ""}
                                    onChange={(e) =>
                                      serviceMap.mutate({ id: svc.id, catalogProductId: e.target.value || null })
                                    }
                                    aria-label={`Map service ${svc.service_name} to a store product`}
                                    className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
                                  >
                                    <option value="">Not mapped</option>
                                    {(catalog ?? []).map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.product_slug} — {p.tier_label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
