export type FatuiPayOrderSource = {
  order_code: string;
  amount_inr: number | null;
  currency: string;
  customer_email: string | null;
  customer_contact: string | null;
  player_name: string | null;
  product_name: string;
  tier_label: string;
  quantity: number;
};

export type FatuiPayCustomerSource = {
  display_name: string | null;
  contact: string | null;
};

export function normalizeUtr(value: string) {
  return value.trim().toUpperCase();
}

export function buildFatuiPayUtrPayload(
  order: FatuiPayOrderSource,
  customer: FatuiPayCustomerSource | null,
  utr: string,
) {
  const amount = Number(order.amount_inr ?? 0);
  if (order.currency !== "INR" || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Fatui Pay UTR submission requires a valid INR order amount");
  }

  const customerName = customer?.display_name?.trim()
    || order.player_name?.trim()
    || order.customer_email?.split("@")[0]?.trim()
    || "Fatui Market Customer";

  return {
    order_id: order.order_code,
    amount,
    utr: normalizeUtr(utr),
    currency: "INR" as const,
    customer_name: customerName,
    customer_phone: order.customer_contact?.trim() || customer?.contact?.trim() || "",
    product_name: order.product_name,
    expires_in_minutes: 1440,
    metadata: {
      items: [{
        product_name: order.product_name,
        tier_label: order.tier_label,
        quantity: Math.max(1, Number(order.quantity) || 1),
      }],
      channel: "web" as const,
    },
  };
}