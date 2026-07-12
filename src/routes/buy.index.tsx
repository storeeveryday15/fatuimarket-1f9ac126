import { createFileRoute, Link } from "@tanstack/react-router";
import { SEO_LANDINGS, seoBaseUrl } from "@/lib/seo-landings";

const URL_ = `${seoBaseUrl}/buy`;

export const Route = createFileRoute("/buy/")({
  head: () => ({
    meta: [
      { title: "Buy Game Top-Ups & Gift Cards in India — Fatui Market" },
      {
        name: "description",
        content:
          "Browse Fatui Market's game top-up and gift-card landing pages. MLBB, Genshin, Wuthering Waves, Free Fire, Steam, Google Play, Razer Gold, Roblox and more.",
      },
      { property: "og:title", content: "Buy Game Top-Ups & Gift Cards in India — Fatui Market" },
      { property: "og:url", content: URL_ },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: URL_ }],
  }),
  component: BuyIndex,
});

function BuyIndex() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-10">
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span className="mx-1">/</span>
        <span className="text-foreground">Buy</span>
      </nav>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Buy game top-ups & gift cards in India
        </h1>
        <p className="mt-3 text-muted-foreground">
          Dedicated guides for every game we top up. Instant delivery, INR pricing, UPI checkout, 24/7 WhatsApp support.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {SEO_LANDINGS.map((l) => (
          <li key={l.slug}>
            <Link
              to="/buy/$slug"
              params={{ slug: l.slug }}
              className="block rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-accent/40"
            >
              <div className="text-sm font-semibold text-foreground">{l.h1}</div>
              <p className="mt-1 text-xs text-muted-foreground">{l.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
