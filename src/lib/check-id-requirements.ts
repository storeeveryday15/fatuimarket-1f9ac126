/**
 * Resolves Check-ID (player verification) requirements for a supplier package.
 *
 * FlashTopup publishes `validation_code`, `check_id_status` and the required
 * customer `fields` on the PRODUCT (/products), not on each package
 * (/services). A package-level value wins when present; otherwise the parent
 * product's definition is used. A package whose own product_code points at a
 * different product is never given that product's validation code.
 *
 * Pure and browser-safe so it can be unit-tested and shared.
 */

export type FieldRole = "user" | "server" | "other";

export type SupplierField = {
  name: string;
  label: string;
  required: boolean;
  type: string;
  placeholder: string | null;
  options: string[];
  role: FieldRole;
};

export type CheckIdRequirement = {
  /** True only when the supplier says Check-ID works AND a validation code exists. */
  supported: boolean;
  validationCode: string | null;
  source: "service" | "product" | null;
  fields: SupplierField[];
  needsServer: boolean;
  /** Required fields the Check-ID request cannot carry (user_id/server_id only). */
  unsupportedFields: string[];
  reason: string | null;
};

export type ResolverProduct = {
  product_code: string;
  product_type?: string | null;
  validation_code: string | null;
  raw?: unknown;
};

export type ResolverService = {
  validation_code: string | null;
  input_fields?: unknown;
  raw?: unknown;
} | null;

const USER_RE = /^(user_?id|userid|player_?id|account_?id|uid|game_?id|role_?id|id)$/i;
const SERVER_RE = /^(server_?id|serverid|zone_?id|zoneid|server|zone)$/i;

export function fieldRole(name: string): FieldRole {
  const n = name.trim();
  if (SERVER_RE.test(n)) return "server";
  if (USER_RE.test(n)) return "user";
  return "other";
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Parses FlashTopup's product `fields` array into a stable shape. */
export function parseSupplierFields(input: unknown): SupplierField[] {
  if (!Array.isArray(input)) return [];
  const out: SupplierField[] = [];
  for (const item of input) {
    if (typeof item === "string") {
      const name = item.trim();
      if (name) out.push({ name, label: name, required: true, type: "text", placeholder: null, options: [], role: fieldRole(name) });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = str(o.name) ?? str(o.field) ?? str(o.key);
    if (!name) continue;
    const options = Array.isArray(o.options)
      ? o.options
          .map((x) => (typeof x === "string" ? x : x && typeof x === "object" ? str((x as any).value) ?? str((x as any).label) : null))
          .filter((x): x is string => Boolean(x))
      : [];
    out.push({
      name,
      label: str(o.label) ?? name,
      required: o.required !== false,
      type: str(o.type) ?? "text",
      placeholder: str(o.placeholder),
      options,
      role: fieldRole(name),
    });
  }
  return out;
}

const rawOf = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export function resolveCheckIdRequirement(product: ResolverProduct | null, service: ResolverService = null): CheckIdRequirement {
  const none = (reason: string, fields: SupplierField[] = []): CheckIdRequirement => ({
    supported: false,
    validationCode: null,
    source: null,
    fields,
    needsServer: fields.some((f) => f.role === "server" && f.required),
    unsupportedFields: [],
    reason,
  });

  if (!product) return none("No supplier product is linked to this package.");

  const praw = rawOf(product.raw);
  const sraw = rawOf(service?.raw);

  // Never borrow a validation code across products.
  const serviceProductCode = str(sraw.product_code);
  if (serviceProductCode && serviceProductCode !== product.product_code) {
    return none(`Package belongs to ${serviceProductCode}, not ${product.product_code}.`);
  }

  let fields = parseSupplierFields(praw.fields);
  if (!fields.length) fields = parseSupplierFields(service?.input_fields);

  const status = str(praw.check_id_status)?.toLowerCase() ?? null;
  const serviceCode = str(service?.validation_code);
  const productCode = str(product.validation_code);
  const validationCode = serviceCode ?? productCode;
  const source = serviceCode ? "service" : productCode ? "product" : null;

  const type = (product.product_type ?? str(praw.product_type) ?? "").toLowerCase();
  if (!validationCode || status === "inactive") {
    const reason =
      type === "giftcard" || type === "voucher"
        ? "Gift card / voucher — delivered as a code, no player ID needed."
        : "The supplier does not offer player-ID verification for this product.";
    return none(reason, fields);
  }

  const unsupportedFields = fields.filter((f) => f.required && f.role === "other").map((f) => f.name);
  return {
    supported: true,
    validationCode,
    source,
    fields,
    needsServer: fields.some((f) => f.role === "server" && f.required),
    unsupportedFields,
    reason: null,
  };
}

/** Required fields the customer left empty, by supplier field name. */
export function missingRequiredFields(req: CheckIdRequirement, userId: string | null, serverId: string | null): string[] {
  return req.fields
    .filter((f) => f.required)
    .filter((f) => (f.role === "user" ? !userId?.trim() : f.role === "server" ? !serverId?.trim() : false))
    .map((f) => f.label);
}
