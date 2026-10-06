import { describe, expect, it } from "vitest";
import {
  isFreshSupplierWebhook,
  selectSupplierService,
  type SupplierServiceCandidate,
} from "../lib/supplier-provider";
import { mapSupplierStatus, verifyWebhookSignature } from "../lib/flashtopup.server";

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

  it("preserves FlashTopup raw-body HMAC verification", async () => {
    const original = process.env["FLASHTOPUP_API_KEY"];
    process.env["FLASHTOPUP_API_KEY"] = "test-only-key";
    const body = JSON.stringify({ event_id: "evt-1", status: "completed" });
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("test-only-key"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
    const signature = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");

    expect(await verifyWebhookSignature(body, signature)).toBe(true);
    expect(await verifyWebhookSignature(`${body} `, signature)).toBe(false);

    if (original === undefined) delete process.env["FLASHTOPUP_API_KEY"];
    else process.env["FLASHTOPUP_API_KEY"] = original;
  });

  it("rejects stale supplier webhooks while accepting missing legacy timestamps", () => {
    const now = Date.parse("2026-10-06T04:00:00Z");
    expect(isFreshSupplierWebhook("2026-10-06T03:59:00Z", now)).toBe(true);
    expect(isFreshSupplierWebhook("2026-10-06T03:00:00Z", now)).toBe(false);
    expect(isFreshSupplierWebhook(undefined, now)).toBe(true);
  });
});