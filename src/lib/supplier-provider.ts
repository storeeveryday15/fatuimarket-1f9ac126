export type SupplierStatus = "pending" | "processing" | "completed" | "failed";

export type SupplierCreateOrderInput = {
  serviceCode: string;
  referenceId: string;
  userId: string;
  serverId?: string | null;
  quantity: number;
};

export type SupplierCreateOrderResult = {
  supplierOrderId: string | null;
  status: SupplierStatus;
  raw: Record<string, unknown>;
};

export type SupplierOrderStatusResult = SupplierCreateOrderResult & {
  delivered: unknown;
  message: string | null;
};

export type SupplierProviderAdapter = {
  key: string;
  createOrder(input: SupplierCreateOrderInput): Promise<SupplierCreateOrderResult>;
  getOrderStatus(input: {
    supplierOrderId?: string | null;
    referenceId: string;
  }): Promise<SupplierOrderStatusResult>;
  normalizeStatus(raw: unknown): SupplierStatus;
  verifyWebhook?(rawBody: string, signature: string | null): Promise<boolean>;
  checkId?: (input: {
    validationCode: string;
    userId: string;
    serverId?: string | null;
  }) => Promise<unknown>;
  syncProducts?: () => Promise<unknown>;
  syncServices?: () => Promise<unknown>;
};

export type SupplierServiceCandidate = {
  serviceCode: string;
  supplierKey: string;
  minQuantity: number;
  maxQuantity: number;
  sortOrder: number;
};

/** Deterministic, server-owned supplier selection. Browser input is never accepted. */
export function selectSupplierService(
  candidates: SupplierServiceCandidate[],
  supportedProviderKeys: ReadonlySet<string>,
): SupplierServiceCandidate | null {
  return (
    candidates
      .filter((candidate) => supportedProviderKeys.has(candidate.supplierKey))
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.supplierKey.localeCompare(b.supplierKey) ||
          a.serviceCode.localeCompare(b.serviceCode),
      )[0] ?? null
  );
}

/** Reject a supplied webhook timestamp outside the accepted clock-skew window. */
export function isFreshSupplierWebhook(
  timestamp: unknown,
  nowMs = Date.now(),
  maxAgeMs = 5 * 60 * 1000,
): boolean {
  if (timestamp === undefined || timestamp === null || timestamp === "") return true;
  const numeric = typeof timestamp === "number" ? timestamp : Number(timestamp);
  const parsed = Number.isFinite(numeric)
    ? numeric < 10_000_000_000
      ? numeric * 1000
      : numeric
    : Date.parse(String(timestamp));
  return Number.isFinite(parsed) && Math.abs(nowMs - parsed) <= maxAgeMs;
}