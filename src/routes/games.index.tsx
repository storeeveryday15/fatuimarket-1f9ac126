import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { listPublicGames, type PublicGame } from "@/lib/flashtopup-catalog.functions";

const gamesQuery = queryOptions({
  queryKey: ["public-games"],
  queryFn: () => listPublicGames(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/games/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(gamesQuery),
  component: GamesPage,
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-muted-foreground">
      The game catalog is taking a break. Please refresh in a moment.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-muted-foreground">Catalog not found.</div>
  ),
  head: () => ({
    meta: [
      { title: "All Games & Top-Up Packages | Fatui Market" },
      {
        name: "description",
        content:
          "Browse every game available at Fatui Market — instant top-ups, gift cards and vouchers with live pricing and stock.",
      },
      { property: "og:title", content: "All Games & Top-Up Packages | Fatui Market" },
      {
        property: "og:description",
        content: "Live catalog of game top-ups, gift cards and vouchers with instant delivery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function GamesPage() {
  const { data: games } = useSuspenseQuery(gamesQuery);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(games.map((g) => g.category).filter(Boolean) as string[])).sort()],
    [games],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games.filter((g) => {
      if (category !== "all" && g.category !== category) return false;
      if (!q) return true;
      return [g.name, g.region, g.category].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [games, query, category]);

  const featured = filtered.filter((g) => g.featured);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-black tracking-tight sm:text-3xl">All games</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {games.length} titles synced live from our supplier — prices and stock update automatically.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-3 text-sm"
            placeholder="Search games, regions or packages"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search games"
          />
        </div>
        <select
          className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All categories" : c}
            </option>
          ))}
        </select>
      </div>

      {featured.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Featured</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="stagger-grid grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
        {!filtered.length && (
          <p className="py-16 text-center text-sm text-muted-foreground">No games match that search.</p>
        )}
      </section>
    </main>
  );
}

function GameCard({ game }: { game: PublicGame }) {
  const body = (
    <div
      className={`card-lift surface-card h-full overflow-hidden ${game.available ? "" : "opacity-60 grayscale"}`}
    >
      <div className="aspect-square w-full overflow-hidden bg-muted/40">
        {game.icon_url ? (
          <img
            src={game.icon_url}
            alt={`${game.name} top-up`}
            width={320}
            height={320}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl font-black text-muted-foreground">
            {game.name.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-bold">{game.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {game.region ? `${game.region} · ` : ""}
          {game.packages} package{game.packages === 1 ? "" : "s"}
        </p>
        <p className="mt-1 text-sm font-semibold">
          {game.available
            ? game.from_price !== null
              ? `From ₹${game.from_price.toFixed(2)}`
              : "View packages"
            : "Out of stock"}
        </p>
      </div>
    </div>
  );

  if (!game.slug || !game.available) return <div>{body}</div>;
  return (
    <Link to="/games/$slug" params={{ slug: game.slug }} className="block">
      {body}
    </Link>
  );
}
