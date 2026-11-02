import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const toStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

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

    const { fetchAllRows } = await import("./fetch-all-rows");
    const data = await fetchAllRows<any>(() =>
      context.supabase
        .from("supplier_services")
        .select(
          "id,supplier_product_id,service_code,service_name,supplier_price,currency,min_quantity,max_quantity,validation_code,input_fields,requires_validation,active,catalog_product_id,supplier_products!inner(supplier_key)",
        )
        .order("service_name", { ascending: true })
        .order("id", { ascending: true }),
    );
    return (data ?? []).map((r: any) => ({
      ...r,
      supplier_key: r.supplier_products.supplier_key,
      supplier_products: undefined,
      input_fields: toStringArray(r.input_fields),
    })) as Array<{
      id: string;
      supplier_product_id: string;
      service_code: string;
      service_name: string;
      supplier_price: number | null;
      currency: string | null;
      min_quantity: number;
      max_quantity: number;
      validation_code: string | null;
      input_fields: string[];
      requires_validation: boolean;
      active: boolean;
      catalog_product_id: string | null;
      supplier_key: string;
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
 * Loads the supplier package (and its parent product) that backs a store
 * product, then resolves Check-ID requirements with parent-product fallback.
 */
async function loadRequirement(supabase: any, catalogProductId: string) {
  const { resolveCheckIdRequirement } = await import("./check-id-requirements");
  const { data: service } = await supabase
    .from("supplier_services")
    .select(
      "validation_code, input_fields, raw, service_code, supplier_products!inner(product_code, product_type, validation_code, raw, supplier_key)",
    )
    .eq("catalog_product_id", catalogProductId)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (service) {
    const product = service.supplier_products as any;
    return { requirement: resolveCheckIdRequirement(product, service), supplierKey: product.supplier_key as string, serviceCode: service.service_code as string | null };
  }
  // Store product mapped at the supplier-product level only.
  const { data: product } = await supabase
    .from("supplier_products")
    .select("product_code, product_type, validation_code, raw, supplier_key")
    .eq("catalog_product_id", catalogProductId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (!product) return null;
  return { requirement: resolveCheckIdRequirement(product, null), supplierKey: product.supplier_key as string, serviceCode: null };
}

/**
 * Player-ID verification for checkout. Signed-in customers only; the supplier
 * credentials and raw provider payload never reach the browser. Verification
 * never marks an order paid or delivered.
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
    const loaded = await loadRequirement(context.supabase, data.catalogProductId);
    if (!loaded || !loaded.requirement.supported) {
      return { required: false as const, verified: true as const, nickname: null, message: null };
    }
    const { requirement } = loaded;
    const { missingRequiredFields } = await import("./check-id-requirements");
    const missing = missingRequiredFields(requirement, data.userId, data.serverId ?? null);
    if (missing.length) {
      return { required: true as const, verified: false as const, nickname: null, message: `Please enter: ${missing.join(", ")}.` };
    }

    const { getSupplierProvider } = await import("./supplier-providers.server");
    const provider = getSupplierProvider(loaded.supplierKey);
    if (!provider?.checkId) {
      return { required: true as const, verified: false as const, nickname: null, message: "Player verification is unavailable for this supplier." };
    }
    const res = (await provider.checkId({
      validationCode: requirement.validationCode!,
      userId: data.userId,
      serverId: requirement.needsServer ? data.serverId ?? null : null,
    })) as Awaited<ReturnType<typeof import("./flashtopup.server")["checkPlayerId"]>>;
    console.log("[check-id] verify", {
      supplier_key: provider.key,
      catalogProductId: data.catalogProductId,
      service_code: loaded.serviceCode,
      validation_code: requirement.validationCode,
      validation_source: requirement.source,
      required_fields: requirement.fields.map((f) => f.name),
      status: res.status,
      ok: res.ok,
      supplier_message: res.message,
    });
    // A supplier/network failure (no HTTP 4xx answer) is not the customer's fault.
    const supplierDown = res.status === null || res.status >= 500;
    return {
      required: true as const,
      verified: res.ok,
      nickname: res.nickname,
      message: res.ok
        ? null
        : supplierDown
          ? "We couldn't reach the game's verification service. Please try again in a moment."
          : res.message || "This player ID couldn't be verified. Please check the details and try again.",
    };
  });


/** Does this store product need player verification before checkout? */
export const getServiceRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ catalogProductId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const loaded = await loadRequirement(context.supabase, data.catalogProductId);
    const req = loaded?.requirement;
    return {
      requiresValidation: Boolean(req?.supported),
      needsServer: Boolean(req?.needsServer),
      inputFields: (req?.fields ?? []).map((f) => f.name),
      fields: (req?.fields ?? []).map((f) => ({ name: f.name, label: f.label, required: f.required, role: f.role, placeholder: f.placeholder })),
    };
  });

/** Admin: every supplier product with its resolved Check-ID requirement. */
export const listCheckIdProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);
    const { resolveCheckIdRequirement } = await import("./check-id-requirements");
    const { data, error } = await context.supabase
      .from("supplier_products")
      .select("id, product_code, name, product_type, region, validation_code, active, fields:raw->fields, check_id_status:raw->>check_id_status")
      .eq("active", true)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((p: any) => {
      const req = resolveCheckIdRequirement({
        product_code: p.product_code,
        product_type: p.product_type,
        validation_code: p.validation_code,
        raw: { fields: p.fields, check_id_status: p.check_id_status },
      });
      return {
        id: p.id as string,
        product_code: p.product_code as string,
        name: p.name as string,
        product_type: (p.product_type ?? null) as string | null,
        region: (p.region ?? null) as string | null,
        requirement: req,
      };
    });
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
    .select("id,supplier_key,product_code,name,product_type,icon_url,validation_code,active,catalog_product_id,updated_at")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      supplier_key: string;
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

export type CheckIdTestResult = {
  ok: boolean;
  supported: boolean;
  product: { product_code: string; name: string } | null;
  validationCode: string | null;
  validationSource: "service" | "product" | null;
  fields: Array<{ name: string; label: string; required: boolean; role: string }>;
  missingFields: string[];
  unsupportedFields: string[];
  status: number | null;
  nickname: string | null;
  message: string | null;
  trace: {
    method: string;
    url: string;
    signedPath: string;
    headers: Record<string, string>;
    requestBody: string;
    status: number | null;
    rawResponse: string;
    error: string | null;
    durationMs: number;
  } | null;
};

/**
 * Admin debugging: run a raw Check-ID call for a supplier product and return
 * the full redacted trace. The validation code always comes from the
 * supplier's own definition; credentials are never included.
 */
export const testCheckId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      supplierProductId: z.string().uuid(),
      userId: z.string().trim().min(1).max(40),
      serverId: z.string().trim().max(20).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }): Promise<CheckIdTestResult> => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);
    const { resolveCheckIdRequirement, missingRequiredFields } = await import("./check-id-requirements");

    const { data: product, error } = await context.supabase
      .from("supplier_products")
      .select("product_code, name, product_type, validation_code, raw")
      .eq("id", data.supplierProductId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!product) throw new Error("Supplier product not found");

    const req = resolveCheckIdRequirement(product as any, null);
    const base = {
      supported: req.supported,
      product: { product_code: product.product_code, name: product.name },
      validationCode: req.validationCode,
      validationSource: req.source,
      fields: req.fields.map((f) => ({ name: f.name, label: f.label, required: f.required, role: f.role })),
      unsupportedFields: req.unsupportedFields,
    };
    if (!req.supported) {
      return { ...base, ok: false, missingFields: [], status: null, nickname: null, message: req.reason, trace: null };
    }
    const missingFields = missingRequiredFields(req, data.userId, data.serverId ?? null);
    if (missingFields.length) {
      return { ...base, ok: false, missingFields, status: null, nickname: null, message: `Missing required inputs: ${missingFields.join(", ")}`, trace: null };
    }

    const { checkPlayerId } = await import("./flashtopup.server");
    const res = await checkPlayerId({
      validation_code: req.validationCode!,
      user_id: data.userId,
      server_id: req.needsServer ? data.serverId ?? null : null,
    });
    return {
      ...base,
      ok: res.ok,
      missingFields: [],
      status: res.status,
      nickname: res.nickname,
      message: res.message,
      trace: {
        method: res.trace.method,
        url: res.trace.url,
        signedPath: res.trace.signedPath,
        headers: res.trace.headers,
        requestBody: JSON.stringify(res.trace.requestBody, null, 2),
        status: res.trace.status,
        rawResponse: res.trace.rawResponse,
        error: res.trace.error,
        durationMs: res.trace.durationMs,
      },
    };
  });

export type ServiceSyncTestResult = {
  ok: boolean;
  productCode: string;
  productType: string | null;
  fetched: number;
  inserted: number;
  deactivated: number;
  rowsInDb: number;
  status: number | null;
  errorCode: string | null;
  message: string | null;
  sample: Array<{ service_code: string; service_name: string; sell_price_inr: number | null; available: boolean }>;
};

/**
 * Admin diagnostic: sync services for a single supplier product (defaults to
 * TOPUP_MOBILE_LEGENDS / topup) and report what actually landed in the DB.
 */
export const testProductServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      productCode: z.string().trim().min(1).max(80).default("TOPUP_MOBILE_LEGENDS"),
      productType: z.string().trim().max(40).nullable().default("topup"),
    }),
  )
  .handler(async ({ data, context }): Promise<ServiceSyncTestResult> => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncServicesForProduct } = await import("./flashtopup-services.server");

    // Resolve the supplier product by its stable product_code. FlashTopup
    // returns regional variants (…_GLOBAL_1, …_BRAZIL_2), so an exact miss
    // falls back to a prefix match on the same product_type.
    let query = supabaseAdmin
      .from("supplier_products")
      .select("id, product_code, product_type")
      .eq("supplier_key", "flashtopup");
    const { data: exact } = await query.eq("product_code", data.productCode).maybeSingle();

    let product = exact ?? null;
    if (!product) {
      let fuzzy = supabaseAdmin
        .from("supplier_products")
        .select("id, product_code, product_type")
        .eq("supplier_key", "flashtopup")
        .ilike("product_code", `${data.productCode}%`)
        .order("product_code", { ascending: true })
        .limit(1);
      if (data.productType) fuzzy = fuzzy.eq("product_type", data.productType);
      const { data: near } = await fuzzy;
      product = near?.[0] ?? null;
    }

    if (!product) {
      return {
        ok: false,
        productCode: data.productCode,
        productType: data.productType,
        fetched: 0,
        inserted: 0,
        deactivated: 0,
        rowsInDb: 0,
        status: null,
        errorCode: "PRODUCT_NOT_SYNCED",
        message: "Run a catalog sync first — this product code is not in the database.",
        sample: [],
      };
    }


    const result = await syncServicesForProduct(supabaseAdmin, {
      id: product.id,
      product_code: product.product_code,
      product_type: data.productType ?? product.product_type,
    });

    const { data: rows, count } = await supabaseAdmin
      .from("supplier_services")
      .select("service_code, service_name, sell_price_inr, available", { count: "exact" })
      .eq("supplier_product_id", product.id)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .limit(5);

    return {
      ok: result.ok,
      productCode: product.product_code,
      productType: data.productType ?? product.product_type,
      fetched: result.inserted,
      inserted: result.inserted,
      deactivated: result.deactivated,
      rowsInDb: count ?? rows?.length ?? 0,
      status: result.status,
      errorCode: result.errorCode,
      message: result.error,
      sample: (rows ?? []) as ServiceSyncTestResult["sample"],
    };
  });
