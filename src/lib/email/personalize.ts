/**
 * Personalization placeholders for announcements (email + in-app).
 *
 * Placeholders use {{ snake_case }} syntax. Unknown placeholders are left
 * untouched so a typo is visible instead of silently blanking the copy.
 */

export type PersonalizationContext = {
  display_name?: string | null;
  username?: string | null;
  email?: string | null;
  favorite_game?: string | null;
  wallet_balance?: number | null;
};

export const PLACEHOLDERS = [
  { token: "{{first_name}}", label: "First name" },
  { token: "{{customer_name}}", label: "Full name" },
  { token: "{{username}}", label: "Username" },
  { token: "{{email}}", label: "Email" },
  { token: "{{favorite_game}}", label: "Favourite game" },
  { token: "{{wallet_balance}}", label: "Wallet balance" },
  { token: "{{store_name}}", label: "Store name" },
  { token: "{{store_url}}", label: "Store URL" },
] as const;

const STORE_NAME = "Fatui Market";
const STORE_URL = "https://fatuimarket.shop";

export function buildPersonalizationValues(
  ctx: PersonalizationContext,
): Record<string, string> {
  const full = (ctx.display_name || ctx.username || "").trim();
  const first = full.split(/\s+/)[0] || "there";
  return {
    first_name: first,
    customer_name: full || "there",
    username: (ctx.username || "").trim() || first,
    email: ctx.email || "",
    favorite_game: (ctx.favorite_game || "").trim() || "your favourite game",
    wallet_balance: `₹${Number(ctx.wallet_balance ?? 0).toFixed(2)}`,
    store_name: STORE_NAME,
    store_url: STORE_URL,
  };
}

/** Replaces every known {{placeholder}} in `input` with the recipient's value. */
export function personalize(input: string, ctx: PersonalizationContext): string {
  const values = buildPersonalizationValues(ctx);
  return input.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key: string) => {
    const value = values[key.toLowerCase()];
    return value === undefined ? match : value;
  });
}
