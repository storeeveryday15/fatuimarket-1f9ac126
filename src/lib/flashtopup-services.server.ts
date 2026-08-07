/** Service catalogue sync for FlashTopup (server-only). */

import { fetchServices, extractServiceList, normalizeService } from "./flashtopup.server";

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export type ServiceSyncResult = {
  products: number;
  services: number;
  deactivated: number;
  failed: number;
};

/** Pulls services for every active supplier product and upserts them. */
export async function syncServicesForAllProducts(admin: AdminClient): Promise<ServiceSyncResult> {
  const { data: products } = await admin
    .from("supplier_products")
    .select("id, product_code")
    .eq("supplier_key", "flashtopup")
    .eq("active", true);

  const list = products ?? [];
  let services = 0;
  let deactivated = 0;
  let failed = 0;

  for (const product of list) {
    try {
      const payload = await fetchServices(product.product_code);
      const rows = extractServiceList(payload)
        .map(normalizeService)
        .filter(Boolean) as NonNullable<ReturnType<typeof normalizeService>>[];

      const { data: existing } = await admin
        .from("supplier_services")
        .select("service_code")
        .eq("supplier_product_id", product.id);
      const existingCodes = new Set((existing ?? []).map((r: { service_code: string }) => r.service_code));

      if (rows.length) {
        const { error } = await admin.from("supplier_services").upsert(
          rows.map((r) => ({
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
            raw: r.raw as never,
            active: true,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "supplier_product_id,service_code" },
        );
        if (error) throw new Error(error.message);
        services += rows.length;
      }

      const incoming = new Set(rows.map((r) => r.service_code));
      const gone = [...existingCodes].filter((c) => !incoming.has(c));
      if (gone.length) {
        await admin
          .from("supplier_services")
          .update({ active: false })
          .eq("supplier_product_id", product.id)
          .in("service_code", gone);
        deactivated += gone.length;
      }
    } catch (err) {
      failed += 1;
      console.error("[flashtopup] service sync failed", {
        product_code: product.product_code,
        message: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return { products: list.length, services, deactivated, failed };
}
