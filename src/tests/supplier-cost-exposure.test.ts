import { describe, expect, it } from "vitest";

/** Live check against the backend using only the public key (anonymous visitor). */
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const get = (path: string) => fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key!, Authorization: `Bearer ${key}` } });

describe.skipIf(!url || !key)("anonymous visitors cannot read supplier costs", () => {
  it.each(["supplier_price", "raw", "sell_price_inr", "currency", "priced_at_supplier_usd", "*"])(
    "supplier_services.%s is denied",
    async (col) => {
      const r = await get(`supplier_services?select=${col}&limit=1`);
      expect(r.status).toBeGreaterThanOrEqual(400);
    },
  );
  it("public package fields remain readable", async () => {
    const r = await get("supplier_services?select=id,service_name,customer_price_inr,available&limit=1");
    expect(r.status).toBe(200);
  });
  it.each(["supplier_price_changes", "supplier_pricing_settings", "supplier_price_history"])("%s returns no rows", async (t) => {
    const r = await get(`${t}?select=*&limit=1`);
    const body = r.status === 200 ? await r.json() : [];
    expect(body).toEqual([]);
  });
});
