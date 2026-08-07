/**
 * FlashTopup reseller API client (server-only).
 *
 * Auth: HMAC-SHA256 over the canonical string
 *   METHOD\n/api/reseller/v2/<path>\n<unix_ts>\n<nonce>\n<sha256_hex(raw_body)>
 * signed with the API key. Credentials are read inside the call, never at
 * module scope, and never reach the browser.
 */

const BASE_PATH = "/api/reseller/v2";
const BASE_URL = `https://api.flashtopup.com${BASE_PATH}`;

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

async function sha256Hex(text: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

async function hmacHex(key: string, message: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message)));
}

export async function flashtopupRequest<T = unknown>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const apiId = process.env["FLASHTOPUP_API_ID"];
  const apiKey = process.env["FLASHTOPUP_API_KEY"];
  if (!apiId || !apiKey) throw new Error("FlashTopup is not configured");

  const method = options.method ?? "GET";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const rawBody = options.body === undefined ? "" : JSON.stringify(options.body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  // Only the path is signed — never the query string or full URL.
  const canonical = [method, `${BASE_PATH}${cleanPath}`, timestamp, nonce, await sha256Hex(rawBody)].join("\n");
  const signature = await hmacHex(apiKey, canonical);

  const qs = options.query ? `?${new URLSearchParams(options.query).toString()}` : "";
  const res = await fetch(`${BASE_URL}${cleanPath}${qs}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-FT-API-ID": apiId,
      "X-FT-Timestamp": timestamp,
      "X-FT-Nonce": nonce,
      "X-FT-Signature": signature,
    },
    ...(rawBody ? { body: rawBody } : {}),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON response */
  }

  if (!res.ok) {
    console.error("[flashtopup] request failed", { path: cleanPath, status: res.status, body: text.slice(0, 500) });
    throw new Error(json?.message || `FlashTopup API error (${res.status})`);
  }
  return json as T;
}

export type NormalizedSupplierProduct = {
  product_code: string;
  name: string;
  product_type: string | null;
  icon_url: string | null;
  validation_code: string | null;
  raw: Record<string, unknown>;
};

const pick = (row: Record<string, any>, keys: string[]): string | null => {
  for (const k of keys) {
    const v = row?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
};

/** Pulls the product array out of whatever envelope the API returns. */
export function extractProductList(payload: any): Record<string, any>[] {
  if (Array.isArray(payload)) return payload;
  for (const key of ["data", "products", "result", "items"]) {
    const v = payload?.[key];
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.products)) return v.products;
    if (v && Array.isArray(v.data)) return v.data;
  }
  return [];
}

/** Maps a raw supplier row onto our columns, tolerating naming variations. */
export function normalizeProduct(row: Record<string, any>): NormalizedSupplierProduct | null {
  const code = pick(row, ["product_code", "productCode", "code", "sku", "id"]);
  if (!code) return null;
  return {
    product_code: code,
    name: pick(row, ["product_name", "productName", "name", "title"]) ?? code,
    product_type: pick(row, ["product_type", "productType", "type", "category"]),
    icon_url: pick(row, ["icon", "icon_url", "iconUrl", "image", "image_url", "logo"]),
    validation_code: pick(row, ["validation_code", "validationCode", "validate_code", "validation"]),
    raw: row,
  };
}

/* ------------------------------------------------------------------ *
 * Services
 * ------------------------------------------------------------------ */

export type NormalizedSupplierService = {
  service_code: string;
  service_name: string;
  supplier_price: number | null;
  currency: string | null;
  min_quantity: number;
  max_quantity: number;
  validation_code: string | null;
  input_fields: string[];
  requires_validation: boolean;
  raw: Record<string, unknown>;
};

const num = (row: Record<string, any>, keys: string[]): number | null => {
  for (const k of keys) {
    const v = row?.[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
};

/** Reads the list of required input field names from any of the shapes the API uses. */
function extractInputFields(row: Record<string, any>): string[] {
  const out = new Set<string>();
  const candidates = [row?.input_fields, row?.inputFields, row?.fields, row?.required_fields, row?.requiredFields];
  for (const c of candidates) {
    if (Array.isArray(c)) {
      for (const item of c) {
        if (typeof item === "string" && item.trim()) out.add(item.trim());
        else if (item && typeof item === "object") {
          const n = item.name ?? item.field ?? item.key ?? item.id;
          if (typeof n === "string" && n.trim()) out.add(n.trim());
        }
      }
    } else if (c && typeof c === "object") {
      for (const k of Object.keys(c)) out.add(k);
    }
  }
  if (!out.size) {
    for (const k of ["user_id", "userId", "server_id", "serverId", "zone_id", "zoneId"]) {
      if (row?.[k] === true || row?.[k] === 1 || row?.[k] === "required") out.add(k.replace(/([A-Z])/g, "_$1").toLowerCase());
    }
  }
  return [...out];
}

export function normalizeService(row: Record<string, any>): NormalizedSupplierService | null {
  const code = pick(row, ["service_code", "serviceCode", "code", "sku", "id"]);
  if (!code) return null;
  const validation = pick(row, ["validation_code", "validationCode", "validate_code", "validation"]);
  const fields = extractInputFields(row);
  const min = num(row, ["min_quantity", "minQuantity", "min", "min_qty"]) ?? 1;
  const max = num(row, ["max_quantity", "maxQuantity", "max", "max_qty"]) ?? Math.max(min, 1);
  return {
    service_code: code,
    service_name: pick(row, ["service_name", "serviceName", "name", "title", "product_name"]) ?? code,
    supplier_price: num(row, ["price", "supplier_price", "supplierPrice", "cost", "amount", "price_inr"]),
    currency: pick(row, ["currency", "currency_code", "currencyCode"]) ?? "INR",
    min_quantity: Math.max(1, Math.round(min)),
    max_quantity: Math.max(1, Math.round(max)),
    validation_code: validation,
    input_fields: fields,
    requires_validation: Boolean(validation) || fields.some((f) => /user|player|uid|server|zone/i.test(f)),
    raw: row,
  };
}

/** Pulls the service array out of whatever envelope the API returns. */
export function extractServiceList(payload: any): Record<string, any>[] {
  if (Array.isArray(payload)) return payload;
  for (const key of ["data", "services", "result", "items"]) {
    const v = payload?.[key];
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.services)) return v.services;
    if (v && Array.isArray(v.data)) return v.data;
  }
  return [];
}

export async function fetchServices(productCode: string) {
  return flashtopupRequest<any>("/services", { query: { product_code: productCode } });
}

/* ------------------------------------------------------------------ *
 * Check-ID / orders
 * ------------------------------------------------------------------ */

export type CheckIdResult = { ok: boolean; nickname: string | null; message: string | null };

export async function checkPlayerId(input: {
  validation_code: string;
  user_id: string;
  server_id?: string | null;
}): Promise<CheckIdResult> {
  try {
    const payload = await flashtopupRequest<any>("/check-id", {
      method: "POST",
      body: {
        validation_code: input.validation_code,
        user_id: input.user_id,
        ...(input.server_id ? { server_id: input.server_id } : {}),
      },
    });
    const body = payload?.data ?? payload ?? {};
    const nickname =
      pick(body, ["nickname", "username", "name", "player_name", "playerName", "user_name"]) ?? null;
    const ok = nickname !== null || body?.status === true || body?.success === true;
    return { ok, nickname, message: pick(body, ["message", "msg"]) };
  } catch (err) {
    return { ok: false, nickname: null, message: err instanceof Error ? err.message : "Verification failed" };
  }
}

export type SupplierOrderResult = {
  supplier_order_id: string | null;
  status: string;
  raw: Record<string, unknown>;
};

const STATUS_MAP: Record<string, "processing" | "completed" | "failed" | "pending"> = {
  pending: "pending",
  waiting: "processing",
  process: "processing",
  processing: "processing",
  in_progress: "processing",
  success: "completed",
  completed: "completed",
  complete: "completed",
  delivered: "completed",
  done: "completed",
  failed: "failed",
  fail: "failed",
  error: "failed",
  cancel: "failed",
  cancelled: "failed",
  canceled: "failed",
  refunded: "failed",
};

export function mapSupplierStatus(raw: unknown): "processing" | "completed" | "failed" | "pending" {
  const key = String(raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return STATUS_MAP[key] ?? "processing";
}

export async function createSupplierOrder(input: {
  service_code: string;
  reference_id: string;
  user_id: string;
  server_id?: string | null;
  quantity: number;
}): Promise<SupplierOrderResult> {
  const payload = await flashtopupRequest<any>("/order", {
    method: "POST",
    body: {
      service_code: input.service_code,
      reference_id: input.reference_id,
      user_id: input.user_id,
      ...(input.server_id ? { server_id: input.server_id } : {}),
      quantity: input.quantity,
    },
  });
  const body = payload?.data ?? payload ?? {};
  return {
    supplier_order_id: pick(body, ["order_id", "orderId", "id", "trx_id", "transaction_id"]),
    status: mapSupplierStatus(pick(body, ["status", "order_status", "state"]) ?? "processing"),
    raw: payload ?? {},
  };
}

export async function fetchOrderStatus(input: { supplier_order_id?: string | null; reference_id: string }) {
  const query: Record<string, string> = { reference_id: input.reference_id };
  if (input.supplier_order_id) query["order_id"] = input.supplier_order_id;
  const payload = await flashtopupRequest<any>("/order-status", { query });
  const body = payload?.data ?? payload ?? {};
  return {
    status: mapSupplierStatus(pick(body, ["status", "order_status", "state"])),
    supplier_order_id: pick(body, ["order_id", "orderId", "id"]),
    delivered: (body?.delivery ?? body?.data ?? body?.sn ?? body?.serial ?? null) as unknown,
    message: pick(body, ["message", "msg", "note"]),
    raw: payload ?? {},
  };
}

/* ------------------------------------------------------------------ *
 * Webhook signature
 * ------------------------------------------------------------------ */

/** Timing-safe HMAC check over the raw webhook body. */
export async function verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const apiKey = process.env["FLASHTOPUP_API_KEY"];
  if (!apiKey || !signature) return false;
  const expected = await hmacHex(apiKey, rawBody);
  const a = new TextEncoder().encode(expected.toLowerCase());
  const b = new TextEncoder().encode(signature.trim().toLowerCase().replace(/^sha256=/, ""));
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}
