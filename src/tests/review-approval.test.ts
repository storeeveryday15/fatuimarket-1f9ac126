import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

/**
 * End-to-end review lifecycle test.
 *
 * 1. A customer submits a review -> it lands as `pending` and must NOT be
 *    visible in the public storefront query.
 * 2. An admin approves it (the exact update the admin panel performs).
 * 3. The storefront query (`reviews_public`, read with the public key) must
 *    now return the review.
 */

const SUPABASE_URL = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
const SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const PUBLIC_KEY =
  process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

const configured = Boolean(SUPABASE_URL && SERVICE_KEY && PUBLIC_KEY);

/** Opaque `sb_` keys are not JWTs — send them as `apikey` only. */
function publicClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

const admin = configured
  ? createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
  : null;
const anon = configured ? publicClient(SUPABASE_URL!, PUBLIC_KEY!) : null;

const productSlug = `e2e-test-${Date.now()}`;
let reviewId: string | null = null;

afterAll(async () => {
  if (admin && reviewId) await admin.from("reviews").delete().eq("id", reviewId);
});

describe.skipIf(!configured)("review approval flow", () => {
  it("keeps a newly submitted review out of the storefront until approved", async () => {
    const { data, error } = await admin!
      .from("reviews")
      .insert({
        product_slug: productSlug,
        full_name: "Test Customer",
        rating: 5,
        review: "Automated end-to-end review check.",
        status: "pending",
      })
      .select("id, status, display_name")
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe("pending");
    // Display name is masked by the database trigger.
    expect(data?.display_name).toBe("Test C.");
    reviewId = data!.id;

    const { data: publicRows, error: publicError } = await anon!
      .from("reviews_public")
      .select("id")
      .eq("product_slug", productSlug);

    expect(publicError).toBeNull();
    expect(publicRows ?? []).toHaveLength(0);
  });

  it("shows the review in the storefront query after an admin approves it", async () => {
    expect(reviewId).toBeTruthy();

    const { error: approveError } = await admin!
      .from("reviews")
      .update({ status: "approved" })
      .eq("id", reviewId!);
    expect(approveError).toBeNull();

    const { data, error } = await anon!
      .from("reviews_public")
      .select("id, display_name, rating, review, product_slug")
      .eq("product_slug", productSlug);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
    expect(data?.[0]).toMatchObject({
      id: reviewId,
      display_name: "Test C.",
      rating: 5,
      review: "Automated end-to-end review check.",
    });
  });
});
