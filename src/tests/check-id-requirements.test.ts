import { describe, expect, it } from "vitest";
import { resolveCheckIdRequirement, missingRequiredFields } from "../lib/check-id-requirements";

const f = (name: string, label = name) => ({ name, label, required: true, type: "text", options: [] });

const mlbbGlobal = {
  product_code: "TOPUP_MOBILE_LEGENDS_GLOBAL",
  product_type: "topup",
  validation_code: "mlbb_global",
  raw: { check_id_status: "active", fields: [f("userid", "User ID"), f("serverid", "Server ID")] },
};

describe("resolveCheckIdRequirement", () => {
  it("falls back to the parent product's validation code when the package has none", () => {
    const r = resolveCheckIdRequirement(mlbbGlobal, {
      validation_code: null,
      raw: { product_code: "TOPUP_MOBILE_LEGENDS_GLOBAL" },
    });
    expect(r.supported).toBe(true);
    expect(r.validationCode).toBe("mlbb_global");
    expect(r.source).toBe("product");
  });

  it("requires Player ID + Server ID for MLBB Global", () => {
    const r = resolveCheckIdRequirement(mlbbGlobal);
    expect(r.needsServer).toBe(true);
    expect(missingRequiredFields(r, "1504182359", null)).toEqual(["Server ID"]);
    expect(missingRequiredFields(r, "1504182359", "12692")).toEqual([]);
  });

  it("does not ask for a server on Player-ID-only games", () => {
    const r = resolveCheckIdRequirement({
      product_code: "TOPUP_ACECRAFT",
      validation_code: "acecraft",
      raw: { check_id_status: "active", fields: [f("userid", "User ID")] },
    });
    expect(r.supported).toBe(true);
    expect(r.needsServer).toBe(false);
  });

  it("never borrows a validation code from a different product", () => {
    const r = resolveCheckIdRequirement(mlbbGlobal, { validation_code: null, raw: { product_code: "TOPUP_FREE_FIRE" } });
    expect(r.supported).toBe(false);
    expect(r.validationCode).toBeNull();
  });

  it("uses a package-level code when the package has one", () => {
    const r = resolveCheckIdRequirement(mlbbGlobal, { validation_code: "mlbb_special", raw: {} });
    expect(r.validationCode).toBe("mlbb_special");
    expect(r.source).toBe("service");
  });

  it("treats check_id_status inactive as not supported, keeping delivery fields", () => {
    const r = resolveCheckIdRequirement({
      product_code: "TOPUP_MOBILE_LEGENDS_DIAMONDS_BRAZIL",
      product_type: "topup",
      validation_code: null,
      raw: { check_id_status: "inactive", fields: [f("userid", "User ID"), f("zoneid", "Zone ID")] },
    });
    expect(r.supported).toBe(false);
    expect(r.needsServer).toBe(true);
  });

  it("gift cards need no player ID and are not supported for Check-ID", () => {
    const r = resolveCheckIdRequirement({
      product_code: "GIFTCARD_MOBILE_LEGENDS_DIAMONDS_PIN",
      product_type: "giftcard",
      validation_code: null,
      raw: { check_id_status: "inactive", fields: [] },
    });
    expect(r.supported).toBe(false);
    expect(r.fields).toEqual([]);
    expect(r.reason).toMatch(/gift card/i);
  });

  it("flags extra required fields Check-ID cannot send", () => {
    const r = resolveCheckIdRequirement({
      product_code: "X",
      validation_code: "x",
      raw: { check_id_status: "active", fields: [f("userid"), f("platform")] },
    });
    expect(r.unsupportedFields).toEqual(["platform"]);
  });
});
