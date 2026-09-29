import { describe, expect, it } from "vitest";
import { buildFatuiPayUtrPayload, normalizeUtr } from "../lib/fatui-pay-submit";

const order = {
  order_code: "FM-ABC123",
  amount_inr: 75,
  currency: "INR",
  customer_email: "customer@example.com",
  customer_contact: "9876543210",
  player_name: "Traveler",
  product_name: "Genshin Impact",
  tier_label: "60 Genesis Crystals",
  quantity: 1,
};

describe("Fatui Pay UTR submission contract", () => {
  it("uses the exact market order code and trusted INR amount", () => {
    const payload = buildFatuiPayUtrPayload(order, { display_name: "Test Customer", contact: null }, " ab12cd34 ");
    expect(payload).toEqual({
      order_id: "FM-ABC123",
      amount: 75,
      utr: "AB12CD34",
      currency: "INR",
      customer_name: "Test Customer",
      customer_phone: "9876543210",
      product_name: "Genshin Impact",
      expires_in_minutes: 1440,
      metadata: {
        items: [{ product_name: "Genshin Impact", tier_label: "60 Genesis Crystals", quantity: 1 }],
        channel: "web",
      },
    });
    expect(payload).not.toHaveProperty("order_code");
  });

  it("normalizes references consistently", () => {
    expect(normalizeUtr("  rrn9a8b7  ")).toBe("RRN9A8B7");
  });

  it("rejects non-INR and invalid trusted amounts", () => {
    expect(() => buildFatuiPayUtrPayload({ ...order, currency: "USD" }, null, "ABC12345")).toThrow("valid INR order amount");
    expect(() => buildFatuiPayUtrPayload({ ...order, amount_inr: 0 }, null, "ABC12345")).toThrow("valid INR order amount");
  });
});