import { createFileRoute } from "@tanstack/react-router";
import { createHmac } from "crypto";

/**
 * TEMPORARY test harness for the Fatui Pay Verify webhook.
 * Computes HMAC signatures server-side (secret never leaves the server),
 * sends signed requests to the actual webhook endpoint, and returns results.
 * Delete this file after testing.
 */
export const Route = createFileRoute("/api/public/fatui-pay/test")({
  server: {
    handlers: {
      GET: async () => {
        const secret = process.env.FATUI_PAY_WEBHOOK_SECRET;
        if (!secret) {
          return Response.json({ error: "FATUI_PAY_WEBHOOK_SECRET not set" }, { status: 500 });
        }

        const WEBHOOK_URL = "http://localhost:8080/api/public/fatui-pay/verify";
        const results: Array<Record<string, unknown>> = [];

        const sign = (body: string) =>
          createHmac("sha256", secret).update(body, "utf8").digest("hex");

        const send = async (body: string, signature: string, label: string) => {
          const res = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-fatui-signature": signature,
            },
            body,
          });
          const text = await res.text();
          results.push({
            label,
            status: res.status,
            response: text,
            bodyPreview: body.slice(0, 120),
          });
        };

        // --- Test 1: Valid signed request with fake order code ---
        const body1 = JSON.stringify({
          event_id: "evt_test_001",
          event: "payment.verified",
          data: {
            status: "verified",
            order_code: "TEST-FAKE-0001",
            payment_id: "pay_test_001",
            amount: 100,
            currency: "INR",
          },
        });
        await send(body1, sign(body1), "test1_valid_signed_fake_order");

        // --- Test 2: Replay same request (duplicate event_id) ---
        await send(body1, sign(body1), "test2_duplicate_event_id");

        // --- Test 3: Non-verified event (review_required) ---
        const body3 = JSON.stringify({
          event_id: "evt_test_003",
          event: "payment.review_required",
          data: {
            status: "review_required",
            order_code: "TEST-FAKE-0003",
            payment_id: "pay_test_003",
            amount: 200,
            currency: "INR",
          },
        });
        await send(body3, sign(body3), "test3_non_verified_event");

        // --- Test 4: Bad signature ---
        await send(body1, "deadbeef0000000000000000000000000000000000000000000000000000000bad", "test4_bad_signature");

        // --- Test 5: Another verified event with a different fake order (fresh event_id) ---
        const body5 = JSON.stringify({
          event_id: "evt_test_005",
          event: "payment.verified",
          data: {
            status: "verified",
            order_code: "TEST-FAKE-0099",
            payment_id: "pay_test_005",
            amount: 500,
            currency: "INR",
          },
        });
        await send(body5, sign(body5), "test5_second_verified_fake_order");

        return Response.json({
          webhookEnabled: String(process.env.FATUI_PAY_WEBHOOK_ENABLED ?? ""),
          testsRun: results.length,
          results,
        });
      },
    },
  },
});
