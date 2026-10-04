import { afterEach, describe, expect, it } from "vitest";
import {
  isVerifiedPayment,
  parsePaymentEvent,
  verifyPaymentSignature,
} from "../lib/fatui-pay.server";

const originalSecret = process.env.FATUI_PAY_WEBHOOK_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.FATUI_PAY_WEBHOOK_SECRET;
  else process.env.FATUI_PAY_WEBHOOK_SECRET = originalSecret;
});

describe("Fatui Pay verified-payment webhook contract", () => {
  it("parses the production Guardian payload fields", () => {
    const event = parsePaymentEvent({
      event_id: "verified:provider-order:event",
      event_type: "payment.verified",
      order_id: "FM-SYNTHETIC",
      sent_at: "2026-10-03T20:23:10Z",
      data: {
        amount: 85,
        currency: "INR",
        external_order_id: "FM-SYNTHETIC",
        order_id: "provider-order",
        product_name: "Synthetic Product",
        rrn: "000000000001",
        verified_at: "2026-10-03T20:23:00Z",
      },
    });

    expect(event).toEqual({
      eventId: "verified:provider-order:event",
      eventType: "payment.verified",
      paymentStatus: "",
      orderCode: "FM-SYNTHETIC",
      paymentReference: "000000000001",
      amount: 85,
      currency: "INR",
    });
    expect(isVerifiedPayment(event)).toBe(true);
  });

  it("verifies HMAC over the exact raw body and rejects a changed body", async () => {
    process.env.FATUI_PAY_WEBHOOK_SECRET = "synthetic-test-secret";
    const rawBody = JSON.stringify({ event_id: "synthetic", event_type: "payment.verified" });
    const { createHmac } = await import("crypto");
    const signature = createHmac("sha256", "synthetic-test-secret").update(rawBody, "utf8").digest("hex");

    await expect(verifyPaymentSignature(rawBody, `sha256=${signature}`)).resolves.toBe(true);
    await expect(verifyPaymentSignature(`${rawBody} `, `sha256=${signature}`)).resolves.toBe(false);
  });
});