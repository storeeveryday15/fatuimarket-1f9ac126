import { describe, expect, it } from "vitest";
import { extractServiceList } from "../lib/flashtopup.server";

const svc = (n: number) => ({
  service_id: n,
  service_code: `SVC_${n}`,
  service_name: `Pack ${n}`,
  product_code: "TOPUP_8_BALL_POOL",
  product_id: 3254,
  price: "1.20",
  currency: "USD",
  in_stock: true,
  max_quantity: 1,
});

describe("extractServiceList", () => {
  it("reads the live v2 envelope data.service", () => {
    const live = {
      success: true,
      error: null,
      data: { product_code: "TOPUP_8_BALL_POOL", product_id: 3254, product_type: "topup", service: Array.from({ length: 13 }, (_, i) => svc(i)) },
      meta: { api_version: "2026-05-21", request_id: "r", sandbox: false },
    };
    expect(extractServiceList(live)).toHaveLength(13);
  });

  it("reads data.services arrays and Laravel pagination data.services.data", () => {
    expect(extractServiceList({ data: { services: [svc(1), svc(2)] } })).toHaveLength(2);
    expect(
      extractServiceList({ data: { services: { current_page: 1, last_page: 1, total: 3, data: [svc(1), svc(2), svc(3)] } } }),
    ).toHaveLength(3);
  });

  it("reads direct arrays", () => {
    expect(extractServiceList([svc(1)])).toHaveLength(1);
  });

  it("returns nothing for empty or malformed responses", () => {
    expect(extractServiceList({ data: { service: [] } })).toEqual([]);
    expect(extractServiceList(null)).toEqual([]);
    expect(extractServiceList("oops")).toEqual([]);
    expect(extractServiceList({ success: false, error: { code: "X" } })).toEqual([]);
  });

  it("never treats metadata or unrelated objects as services", () => {
    expect(extractServiceList({ data: { current_page: 1, total: 5, next_page_url: null }, meta: { request_id: "r" } })).toEqual([]);
    expect(extractServiceList({ data: { service: [{ foo: 1 }, null, "x", svc(1)] } })).toHaveLength(1);
  });
});
