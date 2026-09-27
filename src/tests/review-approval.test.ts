import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

/** End-to-end checks for auto-publication and privacy-safe public review data. */
const SUPABASE_URL = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
const SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const PUBLIC_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
const configured = Boolean(SUPABASE_URL && SERVICE_KEY && PUBLIC_KEY);

function publicClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
}

const admin = configured ? createClient(SUPABASE_URL as string, SERVICE_KEY as string, { auth: { persistSession: false } }) : null;
const anon = configured ? publicClient(SUPABASE_URL as string, PUBLIC_KEY as string) : null;
const productSlug = `e2e-test-${Date.now()}`;
let reviewId: string | null = null;

afterAll(async () => { if (admin && reviewId) await admin.from("reviews").delete().eq("id", reviewId); });

describe.skipIf(!configured)("review auto-publication", () => {
  it("auto-publishes a valid review with a masked public name", async () => {
    const { data, error } = await admin!.from("reviews").insert({
      product_slug: productSlug,
      full_name: "Test Customer",
      rating: 5,
      review: "Automated end-to-end review check.",
      status: "pending",
    }).select("id,status,display_name").single();

    expect(error).toBeNull();
    expect(data?.status).toBe("approved");
    expect(data?.display_name).toBe("Test C.");
    reviewId = data?.id ?? null;

    const { data: publicRows, error: publicError } = await anon!.from("reviews_public")
      .select("id,display_name,rating,review,product_slug").eq("product_slug", productSlug);
    expect(publicError).toBeNull();
    expect(publicRows ?? []).toHaveLength(1);
    expect(publicRows?.[0]).toMatchObject({ id: reviewId, display_name: "Test C.", rating: 5 });
    expect(Object.keys(publicRows?.[0] ?? {})).not.toContain("user_id");
    expect(Object.keys(publicRows?.[0] ?? {})).not.toContain("full_name");
  });

  it("does not expose the private reply table to guests", async () => {
    const { error } = await anon!.from("review_replies").select("user_id").limit(1);
    expect(error).not.toBeNull();
  });
});