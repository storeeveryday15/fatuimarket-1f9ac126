import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * FlashTopup supplier catalog — admin-only server functions.
 * Every handler re-verifies the admin role before touching data, and all
 * supplier API credentials stay server-side.
 */

export const syncFlashtopupProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);

    const { flashtopupRequest, extractProductList, normalizeProduct } = await import("./flashtopup.server");
    const payload = await flashtopupRequest<any>("/products");
    const list = extractProductList(payload);
    const rows = list.map(normalizeProduct).filter(Boolean) as NonNullable<ReturnType<typeof normalizeProduct>>[];

    if (!rows.length) throw new Error("FlashTopup returned no products");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("supplier_products")
      .select("product_code")
      .eq("supplier_key", "flashtopup");
    const existingCodes = new Set((existing ?? []).map((r: { product_code: string }) => r.product_code));

    const { error: upsertError } = await supabaseAdmin.from("supplier_products").upsert(
      rows.map((r) => ({
        supplier_key: "flashtopup",
        product_code: r.product_code,
        name: r.name,
        product_type: r.product_type,
        icon_url: r.icon_url,
        validation_code: r.validation_code,
        raw: r.raw as never,
        active: true,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "supplier_key,product_code" },
    );
    if (upsertError) throw new Error(upsertError.message);

    const incoming = new Set(rows.map((r) => r.product_code));
    const removed = [...existingCodes].filter((c) => !incoming.has(c));
    if (removed.length) {
      await supabaseAdmin
        .from("supplier_products")
        .update({ active: false })
        .eq("supplier_key", "flashtopup")
        .in("product_code", removed);
    }

    const added = rows.filter((r) => !existingCodes.has(r.product_code)).length;
    return { total: rows.length, added, updated: rows.length - added, removed: removed.length };
  });

export const listSupplierProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);

    const { data, error } = await context.supabase
      .from("supplier_products")
      .select("id,product_code,name,product_type,icon_url,validation_code,active,catalog_product_id,updated_at")
      .eq("supplier_key", "flashtopup")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      product_code: string;
      name: string;
      product_type: string | null;
      icon_url: string | null;
      validation_code: string | null;
      active: boolean;
      catalog_product_id: string | null;
      updated_at: string;
    }>;
  });

export const mapSupplierProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), catalogProductId: z.string().uuid().nullable() }))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);

    const { error } = await context.supabase
      .from("supplier_products")
      .update({ catalog_product_id: data.catalogProductId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
