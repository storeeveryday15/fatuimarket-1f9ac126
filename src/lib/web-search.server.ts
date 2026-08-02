/**
 * Live web search for Fatui AI, with a shared database cache.
 *
 * Server-only. Supports (in priority order) Tavily, Serper, Brave Search and
 * Google Programmable Search — whichever API key is configured. When no key is
 * present the assistant silently falls back to its cached game-news table.
 */

import { classifySource } from "@/lib/game-knowledge";

export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
  published?: string | null;
  trust: "official" | "community" | "other";
};

export type SearchOutcome = {
  provider: string;
  cached: boolean;
  hits: SearchHit[];
};

/** How long a search result stays warm before it is refreshed. */
const CACHE_MINUTES = 10;
const MAX_HITS = 6;

function keyFor(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 300);
}

function decorate(raw: Array<{ title: string; url: string; snippet: string; published?: string | null }>): SearchHit[] {
  return raw
    .filter((r) => r.url && r.title)
    .slice(0, MAX_HITS)
    .map((r) => ({ ...r, snippet: (r.snippet || "").slice(0, 700), trust: classifySource(r.url) }))
    // Official sources first so the model quotes them before community pages.
    .sort((a, b) => {
      const rank = { official: 0, community: 1, other: 2 } as const;
      return rank[a.trust] - rank[b.trust];
    });
}

async function tavily(query: string, key: string): Promise<SearchHit[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, max_results: MAX_HITS, search_depth: "basic", topic: "news", include_answer: false }),
  });
  if (!res.ok) throw new Error(`tavily ${res.status}`);
  const json = (await res.json()) as { results?: Array<{ title: string; url: string; content: string; published_date?: string }> };
  return decorate((json.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content, published: r.published_date ?? null })));
}

async function serper(query: string, key: string): Promise<SearchHit[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": key },
    body: JSON.stringify({ q: query, num: MAX_HITS }),
  });
  if (!res.ok) throw new Error(`serper ${res.status}`);
  const json = (await res.json()) as { organic?: Array<{ title: string; link: string; snippet: string; date?: string }> };
  return decorate((json.organic ?? []).map((r) => ({ title: r.title, url: r.link, snippet: r.snippet, published: r.date ?? null })));
}

async function brave(query: string, key: string): Promise<SearchHit[]> {
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${MAX_HITS}`, {
    headers: { Accept: "application/json", "X-Subscription-Token": key },
  });
  if (!res.ok) throw new Error(`brave ${res.status}`);
  const json = (await res.json()) as { web?: { results?: Array<{ title: string; url: string; description: string; age?: string }> } };
  return decorate((json.web?.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.description, published: r.age ?? null })));
}

async function googleCse(query: string, key: string, cx: string): Promise<SearchHit[]> {
  const res = await fetch(
    `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&num=${MAX_HITS}&q=${encodeURIComponent(query)}`,
  );
  if (!res.ok) throw new Error(`google ${res.status}`);
  const json = (await res.json()) as { items?: Array<{ title: string; link: string; snippet: string }> };
  return decorate((json.items ?? []).map((r) => ({ title: r.title, url: r.link, snippet: r.snippet })));
}

export function searchProviderName(): string | null {
  if (process.env["TAVILY_API_KEY"]) return "tavily";
  if (process.env["SERPER_API_KEY"]) return "serper";
  if (process.env["BRAVE_SEARCH_API_KEY"]) return "brave";
  if (process.env["GOOGLE_SEARCH_API_KEY"] && process.env["GOOGLE_SEARCH_CX"]) return "google";
  return null;
}

/** Cached live web search. Never throws — returns an empty result set instead. */
export async function webSearch(query: string): Promise<SearchOutcome> {
  const provider = searchProviderName();
  if (!provider) return { provider: "none", cached: false, hits: [] };

  const cacheKey = `${provider}:${keyFor(query)}`;
  let admin: typeof import("@/integrations/supabase/client.server") | null = null;
  try {
    admin = await import("@/integrations/supabase/client.server");
    const { data } = await admin.supabaseAdmin
      .from("web_search_cache")
      .select("results,expires_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (data && new Date(data.expires_at).getTime() > Date.now()) {
      return { provider, cached: true, hits: (data.results as unknown as SearchHit[]) ?? [] };
    }
  } catch (err) {
    console.error("[web-search] cache read failed", err);
  }

  let hits: SearchHit[] = [];
  try {
    if (provider === "tavily") hits = await tavily(query, process.env["TAVILY_API_KEY"]!);
    else if (provider === "serper") hits = await serper(query, process.env["SERPER_API_KEY"]!);
    else if (provider === "brave") hits = await brave(query, process.env["BRAVE_SEARCH_API_KEY"]!);
    else hits = await googleCse(query, process.env["GOOGLE_SEARCH_API_KEY"]!, process.env["GOOGLE_SEARCH_CX"]!);
  } catch (err) {
    console.error("[web-search] provider failed", provider, err);
    return { provider, cached: false, hits: [] };
  }

  try {
    if (admin) {
      await admin.supabaseAdmin.from("web_search_cache").upsert(
        {
          cache_key: cacheKey,
          query,
          provider,
          results: hits as unknown as never,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + CACHE_MINUTES * 60_000).toISOString(),
        },
        { onConflict: "cache_key" },
      );
    }
  } catch (err) {
    console.error("[web-search] cache write failed", err);
  }

  return { provider, cached: false, hits };
}
