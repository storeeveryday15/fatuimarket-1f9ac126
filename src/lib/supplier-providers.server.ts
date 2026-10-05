import type { SupplierProviderAdapter } from "./supplier-provider";
import {
  checkPlayerId,
  createSupplierOrder,
  fetchOrderStatus,
  mapSupplierStatus,
  verifyWebhookSignature,
} from "./flashtopup.server";

const flashtopupAdapter: SupplierProviderAdapter = {
  key: "flashtopup",
  normalizeStatus: mapSupplierStatus,
  verifyWebhook: verifyWebhookSignature,
  checkId: ({ validationCode, userId, serverId }) =>
    checkPlayerId({ validation_code: validationCode, user_id: userId, server_id: serverId }),
  createOrder: async ({ serviceCode, referenceId, userId, serverId, quantity }) => {
    const result = await createSupplierOrder({
      service_code: serviceCode,
      reference_id: referenceId,
      user_id: userId,
      server_id: serverId,
      quantity,
    });
    return {
      supplierOrderId: result.supplier_order_id,
      status: mapSupplierStatus(result.status),
      raw: result.raw,
    };
  },
  getOrderStatus: async ({ supplierOrderId, referenceId }) => {
    const result = await fetchOrderStatus({
      supplier_order_id: supplierOrderId,
      reference_id: referenceId,
    });
    return {
      supplierOrderId: result.supplier_order_id,
      status: mapSupplierStatus(result.status),
      raw: result.raw,
      delivered: result.delivered,
      message: result.message,
    };
  },
};

const providers = new Map<string, SupplierProviderAdapter>([[flashtopupAdapter.key, flashtopupAdapter]]);

export function getSupplierProvider(supplierKey: string): SupplierProviderAdapter | null {
  return providers.get(supplierKey.trim().toLowerCase()) ?? null;
}

export function getSupportedSupplierKeys(): ReadonlySet<string> {
  return new Set(providers.keys());
}