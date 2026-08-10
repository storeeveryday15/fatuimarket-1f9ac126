/**
 * Full supplier catalog sync (server-only).
 *
 * FlashTopup is the source of truth: every run pulls the complete product list
 * (following pagination), refreshes services/prices, disables anything the API
 * no longer returns, and records the outcome in `supplier_sync_runs` so the
 * storefront never has to call the supplier directly.
 */

import {
  fetchAllProducts,
  fetchAllServices,
  normalizeProduct,

  normalizeService,
  extractRegion,
  extractCategory,
  extractAvailability,
  extractDescription,
  slugify,
} from "./flashtopup.server";

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export type CatalogSyncResult = {
  runId: string | null;
  productsTotal: number;
  productsAdded: number;
  productsUpdated: number;
  productsDisabled: number;
  servicesTotal: number;
  servicesDisabled: number;
  failedProducts: number;
  pages: number;
};

/** Builds a stable, unique slug for a supplier product. */
function buildSlug(name: string, region: string | null, code: string, taken: Set<string>): string {
  const base = slugify([name, region].filter(Boolean).join(" ")) || slugify(code) || "game";
  let slug = base;
  if (taken.has(slug)) slug = `${base}-${slugify(code)}`;
  let i = 2;
  while (taken.has(slug)) slug = `${base}-${i++}`;
  taken.add(slug);
  return slug;
}

export async function runCatalogSync(admin: AdminClient): Promise<CatalogSyncResult> {
  const { data: run } = await admin
    .from("supplier_sync_runs")
    .insert({ kind: "catalog", status: "running" })
    .select("id")
    .maybeSingle();
  const runId = run?.id ?? null;

  const finish = async (patch: Record<string, unknown>) => {
    if (!runId) return;
    await admin
      .from("supplier_sync_runs")
      .update({ finished_at: new Date().toISOString(), ...patch })
      .eq("id", runId);
  };

  try {
    const { rows: rawProducts, pages } = await fetchAllProducts();
    const products = rawProducts
      .map((row) => {
        const norm = normalizeProduct(row);
        if (!norm) return null;
        const region = extractRegion(row, norm.name);
        return { ...norm, region, category: extractCategory(row) };
      })
      .filter(Boolean) as Array<
      ReturnType<typeof normalizeProduct> & { region: string | null; category: string | null }
    >;

    if (!products.length) throw new Error("FlashTopup returned no products");

    const { data: existingRows } = await admin
      .from("supplier_products")
      .select("id, product_code, slug")
      .eq("supplier_key", "flashtopup");
    const existing = new Map((existingRows ?? []).map((r) => [r.product_code, r]));
    const taken = new Set((existingRows ?? []).map((r) => r.slug).filter(Boolean) as string[]);

    const now = new Date().toISOString();
    const payload = products.map((p) => {
      const prev = existing.get(p!.product_code);
      return {
        supplier_key: "flashtopup",
        product_code: p!.product_code,
        name: p!.name,
        product_type: p!.product_type,
        icon_url: p!.icon_url,
        validation_code: p!.validation_code,
        region: p!.region,
        category: p!.category,
        slug: prev?.slug ?? buildSlug(p!.name, p!.region, p!.product_code, taken),
        raw: p!.raw as never,
        active: true,
        updated_at: now,
      };
    });

    // Upsert in chunks so a large catalog never exceeds request limits.
    for (let i = 0; i < payload.length; i += 200) {
      const { error } = await admin
        .from("supplier_products")
        .upsert(payload.slice(i, i + 200), { onConflict: "supplier_key,product_code" });
      if (error) throw new Error(error.message);
    }

    const incoming = new Set(products.map((p) => p!.product_code));
    const stale = [...existing.keys()].filter((code) => !incoming.has(code));
    if (stale.length) {
      for (let i = 0; i < stale.length; i += 200) {
        await admin
          .from("supplier_products")
          .update({ active: false })
          .eq("supplier_key", "flashtopup")
          .in("product_code", stale.slice(i, i + 200));
      }
    }

    const added = products.filter((p) => !existing.has(p!.product_code)).length;

    // --- services / prices ------------------------------------------------
    const { data: liveProducts } = await admin
      .from("supplier_products")
      .select("id, product_code, product_type")
      .eq("supplier_key", "flashtopup")
      .eq("active", true);

    let servicesTotal = 0;
    let servicesDisabled = 0;
    let failedProducts = 0;

    for (const product of liveProducts ?? []) {
      try {
        const fetched = await fetchAllServices(product.product_code, product.product_type);
        if (!fetched.ok) {
          failedProducts += 1;
          continue; // the 191 synced games stay intact
        }
        const list = fetched.rows;
        const rows = list
          .map((r) => {
            const norm = normalizeService(r);
            if (!norm) return null;
            return { ...norm, available: extractAvailability(r), description: extractDescription(r) };
          })
          .filter(Boolean) as Array<
          NonNullable<ReturnType<typeof normalizeService>> & { available: boolean; description: string | null }
        >;


        const { data: existingSvc } = await admin
          .from("supplier_services")
          .select("service_code")
          .eq("supplier_product_id", product.id);
        const existingCodes = new Set((existingSvc ?? []).map((r) => r.service_code));

        if (rows.length) {
          const { error } = await admin.from("supplier_services").upsert(
            rows.map((r, index) => ({
              supplier_product_id: product.id,
              service_code: r.service_code,
              service_name: r.service_name,
              supplier_price: r.supplier_price,
              currency: r.currency,
              min_quantity: r.min_quantity,
              max_quantity: r.max_quantity,
              validation_code: r.validation_code,
              input_fields: r.input_fields as never,
              requires_validation: r.requires_validation,
              available: r.available,
              description: r.description,
              sort_order: index,
              raw: r.raw as never,
              active: true,
              updated_at: now,
            })),
            { onConflict: "supplier_product_id,service_code" },
          );
          if (error) throw new Error(error.message);
          servicesTotal += rows.length;
        }

        const incomingSvc = new Set(rows.map((r) => r.service_code));
        const gone = [...existingCodes].filter((c) => !incomingSvc.has(c));
        if (gone.length) {
          await admin
            .from("supplier_services")
            .update({ active: false, available: false })
            .eq("supplier_product_id", product.id)
            .in("service_code", gone);
          servicesDisabled += gone.length;
        }
      } catch (err) {
        failedProducts += 1;
        console.error("[flashtopup] service sync failed", {
          product_code: product.product_code,
          message: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    // Selling prices always follow the current markup rules.
    await (admin as any).rpc("recompute_sell_prices");

    await finish({
      status: failedProducts && !servicesTotal ? "partial" : "success",
      products_total: products.length,
      products_added: added,
      products_updated: products.length - added,
      products_disabled: stale.length,
      services_total: servicesTotal,
      pages_fetched: pages,
      error: failedProducts ? `${failedProducts} product(s) failed service sync` : null,
    });

    return {
      runId,
      productsTotal: products.length,
      productsAdded: added,
      productsUpdated: products.length - added,
      productsDisabled: stale.length,
      servicesTotal,
      servicesDisabled,
      failedProducts,
      pages,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Catalog sync failed";
    console.error("[flashtopup] catalog sync failed", message);
    await finish({ status: "failed", error: message });
    throw new Error(message);
  }
}

/** Refreshes prices/availability only — no product churn. */
export async function refreshCatalogPrices(admin: AdminClient) {
  const { data: products } = await admin
    .from("supplier_products")
    .select("id, product_code")
    .eq("supplier_key", "flashtopup")
    .eq("active", true);

  let updated = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const product of products ?? []) {
    try {
      const raw = await fetchServices(product.product_code);
      for (const row of extractServiceList(raw)) {
        const norm = normalizeService(row);
        if (!norm) continue;
        const { error } = await admin
          .from("supplier_services")
          .update({
            supplier_price: norm.supplier_price,
            currency: norm.currency,
            available: extractAvailability(row),
            updated_at: now,
          })
          .eq("supplier_product_id", product.id)
          .eq("service_code", norm.service_code);
        if (!error) updated += 1;
      }
    } catch {
      failed += 1;
    }
  }

  await (admin as any).rpc("recompute_sell_prices");
  return { updated, failed, products: products?.length ?? 0 };
}
