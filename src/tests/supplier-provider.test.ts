import { describe, expect, it } from "vitest";
import { selectSupplierService, type SupplierServiceCandidate } from "@/lib/supplier-provider";
import { mapSupplierStatus } from "@/lib/flashtopup.server";

const supported = new Set(["flashtopup", "future-provider"]);

const service = (patch: Partial<SupplierServiceCandidate> = {}): SupplierServiceCandidate => ({
  serviceCode: "SERVICE-1",
  supplierKey: "flashtopup",
  minQuantity: 1,
  maxQuantity: 10,
  sortOrder: 0,
  ...patch,
});

describe("supplier provider dispatch", () => {
  it("resolves a mapped supported provider without accepting customer input", () => {
    expect(selectSupplierService([service()], supported)).toEqual(service());
  });

  it("uses deterministic mapping order when multiple providers are mapped", () => {
    const selected = selectSupplierService(
      [service({ supplierKey: "future-provider", sortOrder: 20 }), service({ sortOrder: 10 })],
      supported,
    );
    expect(selected?.supplierKey).toBe("flashtopup");
  });

  it("rejects an unsupported supplier mapping", () => {
    expect(selectSupplierService([service({ supplierKey: "customer-controlled" })], supported)).toBeNull();
  });

  it("returns no provider when a supplier service is missing", () => {
    expect(selectSupplierService([], supported)).toBeNull();
  });

  it("preserves FlashTopup status normalization", () => {
    expect(mapSupplierStatus("DELIVERED")).toBe("completed");
    expect(mapSupplierStatus("in-progress")).toBe("processing");
    expect(mapSupplierStatus("refunded")).toBe("failed");
  });
});