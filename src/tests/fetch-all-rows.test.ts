import { describe, it, expect } from "vitest";
import { fetchAllRows } from "../lib/fetch-all-rows";

describe("fetchAllRows", () => {
  it("keeps reading past the 1,000-row cap", async () => {
    const all = Array.from({ length: 2500 }, (_, i) => i);
    const rows = await fetchAllRows<number>(() => ({
      range: async (from: number, to: number) => ({ data: all.slice(from, to + 1), error: null }),
    }));
    expect(rows.length).toBe(2500);
  });
});
