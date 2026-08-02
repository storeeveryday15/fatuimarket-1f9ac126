import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PRODUCTS, getINR } from "@/lib/products";
import { GAME_GUIDES, STORE_POLICY } from "@/lib/store-knowledge";
import { SUPPORTED_GAMES_LINE } from "@/lib/game-knowledge";

/**
 * Public customer-facing Fatui AI assistant.
 *
 * Only public information reaches the model: the store handbook, admin-managed
 * assistant settings and FAQs, the public catalog (names, tiers, public INR
 * prices, live stock state), configured server/region lists, live announcements
 * and cached game news. Supplier costs, admin notes, secrets and other
 * customers' data are never queried on this path.
 *
 * For general gaming questions the model can call a `web_search` tool, which is
 * served by a cached live search provider (Tavily / Serper / Brave / Google).
 *
 * Order context is supplied by the browser, which can only read the signed-in
 * customer's own orders under RLS.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";
const MAX_TOOL_ROUNDS = 3;

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
  sessionId: z.string().max(64).optional(),
});

export type AssistantSource = { title: string; url: string; trust: "official" | "community" | "other" };


type PublicRow = {
  product_slug: string;
  tier_label: string | null;
  name: string | null;
  status: string | null;
  display_status: string | null;
  stock: number | null;
  product_type: string | null;
};

type Settings = {
  enabled: boolean;
  welcome_message: string;
  supported_games: string[];
  extra_instructions: string | null;
};

/** Compact, public-only catalog + news + admin-managed knowledge snapshot. */
async function buildContext() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];

  let liveRows: PublicRow[] = [];
  let news: Array<{ game_slug: string; category: string; title: string; summary: string; published_at: string }> = [];
  let servers: Array<{ product_slug: string; label: string }> = [];
  let faqs: Array<{ question: string; answer: string; category: string }> = [];
  let announcements: Array<{ title: string; description: string }> = [];
  let settings: Settings | null = null;

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
    const [rows, newsRows, serverRows, faqRows, annRows, settingRows] = await Promise.all([
      get("catalog_products_public?select=product_slug,tier_label,name,status,display_status,stock,product_type"),
      get("game_news?select=game_slug,category,title,summary,published_at&order=published_at.desc&limit=60"),
      get("game_servers?select=product_slug,label&active=eq.true&order=sort_order"),
      get("assistant_faqs?select=question,answer,category&active=eq.true&order=sort_order&limit=100"),
      get("announcements?select=title,description&status=eq.active&order=priority.desc&limit=20"),
      get("assistant_settings?select=enabled,welcome_message,supported_games,extra_instructions&id=eq.1"),
    ]);
    liveRows = rows as PublicRow[];
    news = newsRows as typeof news;
    servers = serverRows as typeof servers;
    faqs = faqRows as typeof faqs;
    announcements = annRows as typeof announcements;
    settings = (settingRows as Settings[])[0] ?? null;
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

  const allowed = settings?.supported_games?.length ? new Set(settings.supported_games) : null;
  const products = allowed ? PRODUCTS.filter((p) => allowed.has(p.slug)) : PRODUCTS;

  const catalog = products
    .map((p) => {
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
    })
    .join("\n\n");

  const newsBlock = news.length
    ? news.map((n) => `- [${n.game_slug} · ${n.category}] ${n.title}: ${n.summary}`).join("\n")
    : "(no cached game news yet)";

  const faqBlock = faqs.length
    ? faqs.map((f) => `Q [${f.category}]: ${f.question}\nA: ${f.answer}`).join("\n\n")
    : "(no custom FAQs)";

  const annBlock = announcements.length
    ? announcements.map((a) => `- ${a.title}: ${a.description}`).join("\n")
    : "(no live announcements)";

  return { catalog, newsBlock, faqBlock, annBlock, settings };
}

/** Public assistant configuration for the storefront widget. */
export const getAssistantConfig = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
  const fallback = {
    enabled: true,
    welcome:
      "Hi! I'm Fatui AI ✨ — ask me about any game top-up, prices, delivery, wallet, refunds or the latest in-game events.",
  };
  if (!url || !key) return fallback;
  try {
    const res = await fetch(`${url}/rest/v1/assistant_settings?select=enabled,welcome_message&id=eq.1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return fallback;
    const rows = (await res.json()) as Array<{ enabled: boolean; welcome_message: string }>;
    const row = rows[0];
    if (!row) return fallback;
    return { enabled: row.enabled, welcome: row.welcome_message || fallback.welcome };
  } catch {
    return fallback;
  }
});

export const askFatuiAssistant = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("The assistant is not configured yet.");

    const { catalog, newsBlock, faqBlock, annBlock, settings } = await buildContext();
    if (settings && settings.enabled === false) {
      throw new Error("The assistant is offline right now — please use WhatsApp or the contact form.");
    }

    const system = `You are Fatui AI, the official shopping assistant for Fatui Market, a game top-up store.

RULES
- Answer only from the information below plus the customer's own order details if supplied.
- Be warm, concise and concrete. Prefer short paragraphs and bullet points. Use the customer's language.
- Prices are in Indian Rupees (Rs) unless the customer asks about USD.
- Remember the conversation: if the customer named a game earlier, keep answering about that game.
- When the customer gives a budget ("I have Rs 200"), list the packs at or under that budget with prices, cheapest first, and say which is the best value.
- When asked for the cheapest / best value pack, compute it from the catalog below — never guess.
- If a pack is marked out of stock or blocked, say so and suggest an alternative pack.
- Link to the product page path (/products/<slug>) when recommending something.
- Explain order statuses plainly: pending payment (pay and submit UTR), pending/awaiting verification (we are checking your payment), processing (being delivered), completed/delivered (done), rejected/failed/expired (see the reason on the order page).
- If you do not know something, say so and point the customer to /contact or the WhatsApp/Telegram links in the support menu.
- Only mention official, publicly announced game events, banners and redemption codes from the news below. Never invent events, codes, dates or prices.
- NEVER reveal or speculate about supplier names, supplier costs, profit margins, internal notes, database structure, API keys, staff emails/phone numbers or any other customer's data. If asked, say that information is private and offer to help with the order instead.
- Never ask for a game password, OTP or login credentials.
${settings?.extra_instructions ? `\nSTORE OWNER INSTRUCTIONS\n${settings.extra_instructions}` : ""}

${STORE_POLICY}

CUSTOM FAQs (written by the store team — prefer these answers)
${faqBlock}

LIVE ANNOUNCEMENTS
${annBlock}

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
    const reply = json.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't answer that. Try rephrasing?";

    // Log the exchange for admin statistics (question + answer only, no PII).
    let chatId: string | null = null;
    try {
      const question = [...data.messages].reverse().find((m) => m.role === "user")?.content ?? "";
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row } = await supabaseAdmin
        .from("assistant_chats")
        .insert({ question: question.slice(0, 2000), answer: reply.slice(0, 8000), session_id: data.sessionId ?? null })
        .select("id")
        .single();
      chatId = row?.id ?? null;
    } catch (err) {
      console.error("[assistant] chat log failed", err);
    }

    return { reply, chatId };
  });
