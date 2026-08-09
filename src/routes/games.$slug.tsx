import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { getPublicGame } from "@/lib/flashtopup-catalog.functions";

const gameQuery = (slug: string) =>
  queryOptions({
    queryKey: ["public-game", slug],
    queryFn: () => getPublicGame({ data: { slug } }),
    staleTime: 60_000,
  });

export const Route = createFileRoute("/games/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(gameQuery(params.slug));
    if (!data) throw notFound();
    return data;
  },
  component: GameDetailPage,
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-muted-foreground">
      This page could not load. Please refresh.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <p className="text-sm text-muted-foreground">We could not find that game.</p>
      <Link to="/games" className="mt-3 inline-block text-sm font-semibold underline">
        Browse all games
      </Link>
    </div>
  ),
  head: ({ loaderData }) => {
    const name = loaderData?.game.name ?? "Game top-up";
    const title = `${name} Top-Up — Instant Delivery | Fatui Market`;
    const description = `Buy ${name} top-ups at Fatui Market. Live prices, verified player ID and instant automated delivery.`;
    return {
      meta: [
        { title: title.slice(0, 60) },
        { name: "description", content: description.slice(0, 158) },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(loaderData?.game.icon_url?.startsWith("https://")
          ? [
              { property: "og:image", content: loaderData.game.icon_url },
              { name: "twitter:image", content: loaderData.game.icon_url },
            ]
          : []),
      ],
    };
  },
});

function GameDetailPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(gameQuery(slug));
  const [selected, setSelected] = useState<string | null>(null);

  if (!data) return null;
  const { game, packages } = data;
  const active = packages.find((p) => p.id === selected) ?? null;
  const needsPlayerId = active?.requires_validation || active?.input_fields.length;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <Link to="/games" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> All games
      </Link>

      <header className="mt-4 flex flex-wrap items-center gap-4">
        {game.icon_url && (
          <img
            src={game.icon_url}
            alt={`${game.name} logo`}
            width={96}
            height={96}
            className="h-20 w-20 rounded-2xl object-cover"
          />
        )}
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{game.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[game.region, game.category].filter(Boolean).join(" · ") || "Instant top-up"} · {packages.length} packages
          </p>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Choose a package</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={!p.available}
              onClick={() => setSelected(p.id)}
              className={`surface-card p-4 text-left transition ${
                selected === p.id ? "border-[var(--neon)]/70 shadow-[0_0_24px_-10px_var(--neon)]" : ""
              } ${p.available ? "card-lift" : "cursor-not-allowed opacity-60 grayscale"}`}
            >
              <p className="text-sm font-bold">{p.service_name}</p>
              {p.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
              <p className="mt-2 text-base font-black">
                {p.price !== null ? `₹${p.price.toFixed(2)}` : "Price on request"}
              </p>
              {!p.available && <p className="mt-1 text-xs font-semibold text-muted-foreground">Out of stock</p>}
            </button>
          ))}
        </div>
        {!packages.length && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No packages are live for this game right now.
          </p>
        )}
      </section>

      {active && (
        <section className="surface-card mt-8 p-5">
          <h2 className="text-lg font-bold">Continue to checkout</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {needsPlayerId
              ? "We verify your player ID before payment, so the top-up always lands on the right account."
              : "Delivery is automatic once payment is confirmed."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm">
              <span className="font-semibold">{active.service_name}</span> ·{" "}
              {active.price !== null ? `₹${active.price.toFixed(2)}` : "—"}
            </span>
            <Link
              to="/products/$slug"
              params={{ slug }}
              search={{ pkg: active.service_code } as never}
              className="btn-shine rounded-xl bg-[var(--neon)]/15 px-5 py-2.5 text-sm font-bold"
            >
              Buy now
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
