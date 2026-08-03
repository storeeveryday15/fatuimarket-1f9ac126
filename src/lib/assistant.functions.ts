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

const Attachment = z.object({
  url: z.string().max(8_000_000),
  name: z.string().max(200).optional(),
  type: z.string().max(100).optional(),
});

const Input = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
        attachments: z.array(Attachment).max(4).optional(),
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
  let socials: Array<{ key: string; label: string; url: string; description: string }> = [];
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
    const [rows, newsRows, serverRows, faqRows, annRows, socialRows, settingRows] = await Promise.all([
      get("catalog_products_public?select=product_slug,tier_label,name,status,display_status,stock,product_type"),
      get("game_news?select=game_slug,category,title,summary,published_at&order=published_at.desc&limit=60"),
      get("game_servers?select=product_slug,label&active=eq.true&order=sort_order"),
      get("assistant_faqs?select=question,answer,category&active=eq.true&order=sort_order&limit=100"),
      get("announcements?select=title,description&status=eq.active&order=priority.desc&limit=20"),
      get("social_links?select=key,label,url,description&active=eq.true&order=sort_order"),
      get("assistant_settings?select=enabled,welcome_message,supported_games,extra_instructions&id=eq.1"),
    ]);
    liveRows = rows as PublicRow[];
    news = newsRows as typeof news;
    servers = serverRows as typeof servers;
    faqs = faqRows as typeof faqs;
    announcements = annRows as typeof announcements;
    socials = socialRows as typeof socials;
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

  const socialBlock = (socials.length
    ? socials
    : [
        { key: "website", label: "Visit Website", url: "https://fatuimarket.shop", description: "Official store" },
        { key: "youtube", label: "Watch on YouTube", url: "https://youtube.com/@fatuimarket", description: "Videos and guides" },
        { key: "instagram", label: "Follow on Instagram", url: "https://www.instagram.com/fatuimarket", description: "Daily posts" },
        { key: "facebook", label: "Follow on Facebook", url: "https://www.facebook.com/share/199YZVigUE/", description: "Facebook page" },
        { key: "telegram", label: "Join Telegram", url: "https://t.me/fatuimarket", description: "Announcements" },
        { key: "whatsapp_channel", label: "Join WhatsApp Channel", url: "https://whatsapp.com/channel/0029VbD2uz34Y9ljxvkbLS3A", description: "Offers" },
        { key: "whatsapp", label: "Chat on WhatsApp", url: "https://wa.me/917679393645", description: "Support" },
        { key: "email", label: "Email Support", url: "mailto:fatuimarket@gmail.com", description: "Support inbox" },
      ])
    .map((s) => `- key: ${s.key} — ${s.label} (${s.description}) → ${s.url}`)
    .join("\n");

  return { catalog, newsBlock, faqBlock, annBlock, socialBlock, settings };
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

    const { catalog, newsBlock, faqBlock, annBlock, socialBlock, settings } = await buildContext();
    if (settings && settings.enabled === false) {
      throw new Error("The assistant is offline right now — please use WhatsApp or the contact form.");
    }

    const { searchProviderName } = await import("@/lib/web-search.server");
    const searchEnabled = Boolean(searchProviderName());

    const system = `You are Fatui AI, the official gaming + shopping assistant for Fatui Market, a game top-up store.

You have two jobs:
1. STORE — prices, packs, stock, ordering, order tracking, wallet, cashback, coupons, refunds, delivery.
2. GAMING — general knowledge about games: upcoming events, banners, skins, heroes/agents/characters, redeem codes, patch notes, maintenance, esports, builds, tier lists, beginner guides, release dates, system requirements, cross-platform support and gameplay tips.

GAMES YOU COVER (and any newer title the customer asks about)
${SUPPORTED_GAMES_LINE}

RULES
- Be warm, concise and concrete. Short paragraphs and bullet points. Reply in the customer's language.
- Remember the conversation: if the customer named a game earlier, keep answering about that game and do not re-ask what you already know.
- STORE facts (prices, stock, packs, policies) come ONLY from the catalog and handbook below — never from the web, never guessed.
- Prices are in Indian Rupees (Rs) unless the customer asks about USD.
- When the customer gives a budget, list packs at or under it, cheapest first, and name the best value.
- If a pack is out of stock or blocked, say so and suggest an alternative.
- Link to the product page path (/products/<slug>) when recommending something, but only recommend a Fatui Market product when it is genuinely relevant to what was asked. Never turn a pure gaming question into a sales pitch.
- Explain order statuses plainly: pending payment (pay and submit UTR), pending/awaiting verification (we are checking your payment), processing (being delivered), completed/delivered (done), rejected/failed/expired (see the reason on the order page).
${
  searchEnabled
    ? `- For anything time-sensitive or outside the store (current banners, events, codes, patch notes, maintenance, esports results, tier lists, release dates), CALL the web_search tool first. Never answer such questions from memory.
- Each search result is labelled OFFICIAL (publisher/first-party), COMMUNITY (wiki, news site, creator) or UNVERIFIED. Say which kind of source your claim comes from, e.g. "Officially announced by HoYoverse" vs "Community reports suggest". Never present community speculation as official.
- If search finds nothing solid, say you could not confirm it rather than inventing an answer.`
    : `- Live web search is not configured, so for time-sensitive gaming questions rely on the cached news below and clearly say when your information may be out of date. Never invent events, codes or dates.`
}
- NEVER invent events, codes, dates, prices or patch notes.
- NEVER reveal or speculate about supplier names, supplier costs, profit margins, internal notes, database structure, API keys, staff contact details or any other customer's data. If asked, say that information is private.
- Never ask for a game password, OTP or login credentials.

IMAGES THE CUSTOMER UPLOADS
- You can see uploaded images. Read any text in them (receipts, UTR numbers, error messages, order codes), explain game screens and items, diagnose login/payment/top-up errors, and answer follow-up questions about the same image later in the chat.
- If a receipt or screenshot is unreadable, say exactly what is unclear and what to re-send.
- You may describe people who appear in a photo (clothing, pose, setting) but never guess or state who an unknown real person is, and never help make a misleading edit of a real person.
- Uploaded files belong to that customer alone. Never mention or compare another customer's uploads.

CREATING IMAGES
- The customer can generate art with the image button in the chat (wallpapers, anime art, banners, avatars, logos, posters) and edit an uploaded picture (background removal, upscaling, object removal, colour changes, adding text, thumbnails, Fatui Market promos). Point them to it when they ask for artwork.
- Unsafe requests (sexual content, minors, gore, hate, illegal activity, impersonation, deepfakes, copyrighted characters or logos) are blocked automatically. If asked for one, explain kindly why and offer a safe original alternative.

${settings?.extra_instructions ? `\nSTORE OWNER INSTRUCTIONS\n${settings.extra_instructions}` : ""}

${STORE_POLICY}

CUSTOM FAQs (written by the store team — prefer these answers)
${faqBlock}

LIVE ANNOUNCEMENTS
${annBlock}

GAME CATALOG (live prices and stock)
${catalog}

CACHED GAME NEWS (store-curated)
${newsBlock}
${data.orderContext ? `\nTHIS CUSTOMER'S RECENT ORDERS\n${data.orderContext}` : ""}`;

    const tools = searchEnabled
      ? [
          {
            type: "function",
            function: {
              name: "web_search",
              description:
                "Search the live web for current gaming information: events, banners, redeem codes, patch notes, maintenance, esports, tier lists, builds, release dates and system requirements. Do not use it for Fatui Market prices, stock or policies.",
              parameters: {
                type: "object",
                properties: {
                  query: { type: "string", description: "A focused search query, including the game name and the current month/year when relevant." },
                },
                required: ["query"],
              },
            },
          },
        ]
      : undefined;

    type ContentPart =
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } };

    type ChatMsg = {
      role: "system" | "user" | "assistant" | "tool";
      content: string | ContentPart[] | null;
      tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
      tool_call_id?: string;
    };

    /** Turns an uploaded file into a model-readable part (images) or a note (other files). */
    const toParts = (m: (typeof data.messages)[number]): string | ContentPart[] => {
      const files = m.attachments ?? [];
      if (!files.length) return m.content;
      const parts: ContentPart[] = [];
      const notes: string[] = [];
      for (const f of files) {
        const type = f.type ?? "";
        if (type.startsWith("image/") && f.url) parts.push({ type: "image_url", image_url: { url: f.url } });
        else if (type.startsWith("video/")) notes.push(`[customer attached a video: ${f.name ?? "clip"} — you cannot watch videos; ask for a screenshot of the moment they need help with]`);
        else notes.push(`[customer attached a file: ${f.name ?? "file"}]`);
      }
      const text = [m.content, ...notes].filter(Boolean).join("\n");
      parts.unshift({ type: "text", text: text || "Please look at this." });
      return parts;
    };

    const convo: ChatMsg[] = [
      { role: "system", content: system },
      ...data.messages.map((m) => ({ role: m.role, content: toParts(m) }) as ChatMsg),
    ];

    const sources: AssistantSource[] = [];
    let reply = "";

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const res = await fetch(GATEWAY, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: MODEL, messages: convo, ...(tools && round < MAX_TOOL_ROUNDS ? { tools } : {}) }),
      });

      if (res.status === 429) throw new Error("Too many questions right now — please try again in a moment.");
      if (res.status === 402) throw new Error("The assistant is temporarily unavailable. Please use WhatsApp support.");
      if (!res.ok) {
        console.error("[assistant] gateway error", res.status, await res.text().catch(() => ""));
        throw new Error("The assistant hit an error. Please try again.");
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string; tool_calls?: ChatMsg["tool_calls"] } }>;
      };
      const message = json.choices?.[0]?.message;
      const calls = message?.tool_calls ?? [];

      if (!calls.length) {
        reply = message?.content?.trim() || "Sorry, I couldn't answer that. Try rephrasing?";
        break;
      }

      convo.push({ role: "assistant", content: message?.content ?? null, tool_calls: calls });

      const { webSearch } = await import("@/lib/web-search.server");
      for (const call of calls) {
        let query = "";
        try {
          query = String((JSON.parse(call.function.arguments || "{}") as { query?: string }).query ?? "");
        } catch {
          /* ignore malformed arguments */
        }
        const outcome = query ? await webSearch(query) : { hits: [], provider: "none", cached: false };
        for (const h of outcome.hits) {
          if (!sources.some((s) => s.url === h.url)) sources.push({ title: h.title, url: h.url, trust: h.trust });
        }
        const body = outcome.hits.length
          ? outcome.hits
              .map(
                (h, i) =>
                  `[${i + 1}] ${h.trust === "official" ? "OFFICIAL" : h.trust === "community" ? "COMMUNITY" : "UNVERIFIED"} — ${h.title}\n${h.url}\n${h.snippet}`,
              )
              .join("\n\n")
          : "No results found. Tell the customer you could not confirm this.";
        convo.push({ role: "tool", tool_call_id: call.id, content: body });
      }
    }

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

    return { reply, chatId, sources };
  });

/** Generates a short title for a saved conversation from its opening exchange. */
export const generateChatTitle = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ text: z.string().min(1).max(2000) }).parse(data))
  .handler(async ({ data }) => {
    const fallback = data.text.replace(/\s+/g, " ").slice(0, 48);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { title: fallback };
    try {
      const res = await fetch(GATEWAY, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: "Write a 2-5 word title for this chat. Plain text only, no quotes, no punctuation at the end." },
            { role: "user", content: data.text.slice(0, 800) },
          ],
        }),
      });
      if (!res.ok) return { title: fallback };
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const title = json.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, "").slice(0, 60);
      return { title: title || fallback };
    } catch {
      return { title: fallback };
    }
  });

