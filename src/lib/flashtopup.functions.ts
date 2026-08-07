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

    // Services always follow a product refresh.
    const { syncServicesForAllProducts } = await import("./flashtopup-services.server");
    const svc = await syncServicesForAllProducts(supabaseAdmin);

    return {
      total: rows.length,
      added,
      updated: rows.length - added,
      removed: removed.length,
      services: svc.services,
    };
  });

export const syncFlashtopupServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncServicesForAllProducts } = await import("./flashtopup-services.server");
    return syncServicesForAllProducts(supabaseAdmin);
  });

export const listSupplierServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);

    const { data, error } = await context.supabase
      .from("supplier_services")
      .select(
        "id,supplier_product_id,service_code,service_name,supplier_price,currency,min_quantity,max_quantity,validation_code,input_fields,requires_validation,active,catalog_product_id",
      )
      .order("service_name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      supplier_product_id: string;
      service_code: string;
      service_name: string;
      supplier_price: number | null;
      currency: string | null;
      min_quantity: number;
      max_quantity: number;
      validation_code: string | null;
      input_fields: unknown;
      requires_validation: boolean;
      active: boolean;
      catalog_product_id: string | null;
    }>;
  });

export const mapSupplierService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), catalogProductId: z.string().uuid().nullable() }))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);

    const { error } = await context.supabase
      .from("supplier_services")
      .update({ catalog_product_id: data.catalogProductId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Player-ID verification for checkout. Signed-in customers only; the supplier
 * credentials and raw provider payload never reach the browser.
 */
export const verifyPlayerId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      catalogProductId: z.string().uuid(),
      userId: z.string().trim().min(1).max(40),
      serverId: z.string().trim().max(20).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: service } = await context.supabase
      .from("supplier_services")
      .select("validation_code, requires_validation, active")
      .eq("catalog_product_id", data.catalogProductId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (!service || !service.requires_validation || !service.validation_code) {
      return { required: false as const, verified: true as const, nickname: null, message: null };
    }

    const { checkPlayerId } = await import("./flashtopup.server");
    const res = await checkPlayerId({
      validation_code: service.validation_code,
      user_id: data.userId,
      server_id: data.serverId ?? null,
    });
    return {
      required: true as const,
      verified: res.ok,
      nickname: res.nickname,
      message: res.ok ? null : "We could not find that player ID. Please check and try again.",
    };
  });

/** Does this store product need player verification before checkout? */
export const getServiceRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ catalogProductId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: service } = await context.supabase
      .from("supplier_services")
      .select("requires_validation, validation_code, input_fields")
      .eq("catalog_product_id", data.catalogProductId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    return {
      requiresValidation: Boolean(service?.requires_validation && service?.validation_code),
      inputFields: (service?.input_fields ?? []) as unknown,
    };
  });

/** Admin: poll every supplier order still in flight. */
export const pollSupplierOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { refreshSupplierOrder } = await import("./flashtopup-fulfil.server");
    const { data: rows } = await supabaseAdmin
      .from("supplier_orders")
      .select("reference_id")
      .in("status", ["pending", "processing"])
      .limit(50);

    let completed = 0;
    let failed = 0;
    for (const row of rows ?? []) {
      try {
        const res = await refreshSupplierOrder(row.reference_id);
        if (res.status === "completed") completed += 1;
        if (res.status === "failed") failed += 1;
      } catch (err) {
        console.error("[flashtopup] poll failed", err instanceof Error ? err.message : err);
      }
    }
    return { polled: rows?.length ?? 0, completed, failed };
  });

/** Admin: send (or re-send) an order to the supplier. Idempotent. */
export const fulfilOrderWithSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ orderCode: z.string().trim().min(1).max(64) }))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);

    const { fulfilOrder } = await import("./flashtopup-fulfil.server");
    return fulfilOrder(data.orderCode);
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
