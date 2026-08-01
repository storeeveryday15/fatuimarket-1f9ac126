import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PRODUCTS, getINR } from "@/lib/products";
import { GAME_GUIDES, STORE_POLICY } from "@/lib/store-knowledge";

/**
 * Public customer-facing Fatui AI assistant.
 *
 * Only public information reaches the model: the store handbook, the public
 * catalog (names, tiers, public INR prices, live stock state), configured
 * server/region lists and cached game news. Supplier costs, admin notes,
 * secrets and other customers' data are never queried on this path.
 *
 * Order context is supplied by the browser, which can only read the signed-in
 * customer's own orders under RLS.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

const Input = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(30),
  orderContext: z.string().max(2000).optional(),
});

type PublicRow = {
  product_slug: string;
  tier_label: string | null;
  name: string | null;
  status: string | null;
  display_status: string | null;
  stock: number | null;
  product_type: string | null;
};

/** Compact, public-only catalog + news snapshot. */
async function buildContext() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];

  let liveRows: PublicRow[] = [];
  let news: Array<{ game_slug: string; category: string; title: string; summary: string; published_at: string }> = [];
  let servers: Array<{ product_slug: string; label: string }> = [];

  if (url && key) {
    const get = async (path: string) => {
      try {
        const res = await fetch(`${url}/rest/v1/${path}`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        });
        if (!res.ok) return [];
        return (await res.json()) as unknown[];
      } catch (err) {
        console.error("[assistant] context fetch failed", path, err);
        return [];
      }
    };
    const [rows, newsRows, serverRows] = await Promise.all([
      get("catalog_products_public?select=product_slug,tier_label,name,status,display_status,stock,product_type"),
      get("game_news?select=game_slug,category,title,summary,published_at&order=published_at.desc&limit=60"),
      get("game_servers?select=product_slug,label&active=eq.true&order=sort_order"),
    ]);
    liveRows = rows as PublicRow[];
    news = newsRows as typeof news;
    servers = serverRows as typeof servers;
  }

  const stateFor = (slug: string, tier: string) => {
    const r = liveRows.find((x) => x.product_slug === slug && (x.tier_label === tier || x.name === tier));
    if (!r) return "";
    const ds = r.display_status && r.display_status !== "auto" ? r.display_status : null;
    if (ds && ds !== "normal") return ` [${ds.replace(/_/g, " ")}]`;
    if (r.status === "out_of_stock" || (r.product_type === "limited" && (r.stock ?? 0) <= 0)) return " [out of stock]";
    if (r.status && r.status !== "active") return ` [${r.status.replace(/_/g, " ")}]`;
    return "";
  };

  const catalog = PRODUCTS.map((p) => {
    const guide = GAME_GUIDES[p.slug];
    const regionList = servers.filter((s) => s.product_slug === p.slug).map((s) => s.label);
    const tiers = p.denominations
      .map((d) => `${d.label} — Rs ${getINR(d)}${d.bonus ? ` (${d.bonus})` : ""}${stateFor(p.slug, d.label)}`)
      .join("; ");
    return [
      `## ${p.name} (/products/${p.slug}) — ${p.publisher}, currency: ${p.currency}`,
      guide ? `Needs: ${guide.needs}` : "",
      `Servers/regions: ${regionList.length ? regionList.join(", ") : (guide?.servers ?? "n/a")}`,
      guide ? `Delivery: ${guide.delivery}` : "",
      guide ? `Common issues: ${guide.issues}` : "",
      `Packs: ${tiers}`,
    ]
      .filter(Boolean)
      .join("\n");
  }).join("\n\n");

  const newsBlock = news.length
    ? news.map((n) => `- [${n.game_slug} · ${n.category}] ${n.title}: ${n.summary}`).join("\n")
    : "(no cached game news yet)";

  return { catalog, newsBlock };
}

export const askFatuiAssistant = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("The assistant is not configured yet.");

    const { catalog, newsBlock } = await buildContext();

    const system = `You are Fatui AI, the official assistant for Fatui Market, a game top-up store.

RULES
- Answer only from the information below plus the customer's own order details if supplied.
- Be warm, concise and concrete. Prefer short paragraphs and bullet points. Use the customer's language.
- Prices are in Indian Rupees (Rs) unless the customer asks about USD.
- If a pack is marked out of stock or blocked, say so and suggest an alternative pack.
- If you do not know something, say so and point the customer to /contact or the WhatsApp/Telegram links in the support menu.
- NEVER reveal or speculate about supplier names, supplier costs, profit margins, internal notes, database structure, API keys or any other customer's data. If asked, say that information is private and offer to help with the order instead.
- Never ask for a game password, OTP or login credentials.

${STORE_POLICY}

GAME CATALOG (live prices and stock)
${catalog}

LATEST GAME NEWS (cached from official sources)
${newsBlock}
${data.orderContext ? `\nTHIS CUSTOMER'S RECENT ORDERS\n${data.orderContext}` : ""}`;

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });

    if (res.status === 429) throw new Error("Too many questions right now — please try again in a moment.");
    if (res.status === 402) throw new Error("The assistant is temporarily unavailable. Please use WhatsApp support.");
    if (!res.ok) {
      console.error("[assistant] gateway error", res.status, await res.text().catch(() => ""));
      throw new Error("The assistant hit an error. Please try again.");
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return { reply: json.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't answer that. Try rephrasing?" };
  });
