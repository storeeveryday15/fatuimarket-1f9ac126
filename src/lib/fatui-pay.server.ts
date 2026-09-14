/**
 * Fatui Pay Verify webhook helpers (server-only).
 *
 * The shared secret lives in FATUI_PAY_WEBHOOK_SECRET and is read per-request
 * inside handlers. It is never imported by client code and never logged.
 */

/** The receiver stays inert until this is explicitly set to "true". */
export function isWebhookEnabled() {
  return String(process.env.FATUI_PAY_WEBHOOK_ENABLED ?? "").toLowerCase() === "true";
}

/**
 * Verifies an HMAC-SHA256 signature over the raw request body.
 * Accepts bare hex/base64 as well as prefixed forms ("sha256=<hex>").
 */
export async function verifyPaymentSignature(rawBody: string, header: string | null): Promise<boolean> {
  const secret = process.env.FATUI_PAY_WEBHOOK_SECRET;
  if (!secret || !header) return false;

  const provided = header.includes("=") ? header.split("=").pop()!.trim() : header.trim();
  const { createHmac, timingSafeEqual } = await import("crypto");
  const digest = createHmac("sha256", secret).update(rawBody, "utf8");
  const expectedHex = digest.digest("hex");
  const expectedB64 = Buffer.from(expectedHex, "hex").toString("base64");

  const compare = (a: string, b: string) => {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  };

  return compare(provided.toLowerCase(), expectedHex) || compare(provided, expectedB64);
}

export type VerifiedPaymentEvent = {
  eventId: string;
  eventType: string;
  paymentStatus: string;
  orderCode: string | null;
  paymentReference: string | null;
  amount: number | null;
  currency: string | null;
};

/** Normalises the webhook body into the fields we act on. */
export function parsePaymentEvent(payload: Record<string, any>): VerifiedPaymentEvent {
  const body = (payload?.data ?? payload) as Record<string, any>;
  const str = (v: unknown) => {
    const s = v == null ? "" : String(v).trim();
    return s || null;
  };
  return {
    eventId: str(payload?.event_id ?? payload?.eventId ?? body?.event_id ?? body?.id) ?? "",
    eventType: (str(payload?.event ?? payload?.type ?? body?.event) ?? "").toLowerCase(),
    paymentStatus: (str(body?.status ?? body?.payment_status) ?? "").toLowerCase(),
    orderCode: str(body?.order_code ?? body?.orderCode ?? body?.reference ?? body?.reference_id),
    paymentReference: str(body?.payment_id ?? body?.paymentId ?? body?.transaction_id ?? body?.utr),
    amount: body?.amount != null && !Number.isNaN(Number(body.amount)) ? Number(body.amount) : null,
    currency: str(body?.currency)?.toUpperCase() ?? null,
  };
}

/** Only a genuine payment.verified / verified-status event may fulfil. */
export function isVerifiedPayment(event: VerifiedPaymentEvent) {
  const typeOk = event.eventType === "payment.verified" || event.eventType === "payment_verified";
  const statusOk = event.paymentStatus === "" || event.paymentStatus === "verified" || event.paymentStatus === "success";
  return typeOk && statusOk;
}
