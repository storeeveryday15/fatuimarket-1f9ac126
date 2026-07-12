import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getSeoLanding, seoBaseUrl, SEO_LANDINGS } from "@/lib/seo-landings";
import { getProduct } from "@/lib/products";

export const Route = createFileRoute("/buy/$slug")({
  loader: ({ params }) => {
    const landing = getSeoLanding(params.slug);
    if (!landing) throw notFound();
    return { landing };
  },
  head: ({ params }) => {
    const l = getSeoLanding(params.slug);
    if (!l) return { meta: [{ title: "Not found" }, { name: "robots", content: "noindex" }] };
    const url = `${seoBaseUrl}/buy/${l.slug}`;
    const product = l.productSlug ? getProduct(l.productSlug) : undefined;
    const image = l.image ?? product?.image;
    const absImage = image
      ? image.startsWith("http")
        ? image
        : `${seoBaseUrl}${image}`
      : undefined;

    const productSchema = product
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          image: absImage,
          description: l.description,
          brand: { "@type": "Brand", name: product.publisher },
          offers: {
            "@type": "AggregateOffer",
            lowPrice: Math.min(...product.denominations.map((d) => d.price)).toFixed(2),
            highPrice: Math.max(...product.denominations.map((d) => d.price)).toFixed(2),
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
          },
        }
      : null;

    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: l.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: seoBaseUrl },
        { "@type": "ListItem", position: 2, name: "Buy", item: `${seoBaseUrl}/buy` },
        { "@type": "ListItem", position: 3, name: l.breadcrumb, item: url },
      ],
    };

    const meta: Array<Record<string, string>> = [
      { title: l.title },
      { name: "description", content: l.description },
      { property: "og:title", content: l.title },
      { property: "og:description", content: l.description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: l.title },
      { name: "twitter:description", content: l.description },
    ];
    if (absImage) {
      meta.push({ property: "og:image", content: absImage });
      meta.push({ name: "twitter:image", content: absImage });
    }

    const scripts: Array<{ type: string; children: string }> = [
      { type: "application/ld+json", children: JSON.stringify(faqSchema) },
      { type: "application/ld+json", children: JSON.stringify(breadcrumbSchema) },
    ];
    if (productSchema) {
      scripts.unshift({ type: "application/ld+json", children: JSON.stringify(productSchema) });
    }

    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts,
    };
  },
  notFoundComponent: () => (
    <div className="container mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">
        Back to home
      </Link>
    </div>
  ),
  component: SeoLandingPage,
});

function SeoLandingPage() {
  const { landing: l } = Route.useLoaderData();
  const product = l.productSlug ? getProduct(l.productSlug) : undefined;
  const heroImage = l.image ?? product?.image;
  const imageAlt = l.imageAlt ?? `${l.h1} — Fatui Market`;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span className="mx-1">/</span>
        <span>Buy</span>
        <span className="mx-1">/</span>
        <span className="text-foreground">{l.breadcrumb}</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{l.h1}</h1>
        <p className="mt-3 text-muted-foreground">{l.intro}</p>
        {heroImage && (
          <img
            src={heroImage}
            alt={imageAlt}
            width={1200}
            height={630}
            loading="lazy"
            decoding="async"
            className="mt-6 aspect-[1200/630] w-full rounded-xl border border-border object-cover"
          />
        )}
        {product && (
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/products/$slug"
              params={{ slug: product.slug }}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Top up {product.name} now
            </Link>
            <Link
              to="/track"
              className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Track an order
            </Link>
          </div>
        )}
      </header>

      {/* Trust bar */}
      <section className="mb-8 grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
        <div>
          <div className="text-sm font-semibold text-foreground">⚡ Fast delivery</div>
          <p className="text-xs text-muted-foreground">Most orders in a few minutes.</p>
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground">🔒 Secure payments</div>
          <p className="text-xs text-muted-foreground">Razorpay with 3D-Secure.</p>
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground">💬 24/7 support</div>
          <p className="text-xs text-muted-foreground">WhatsApp help anytime.</p>
        </div>
      </section>

      {/* Body sections */}
      {l.sections.map((s, i) => (
        <section key={i} className="mb-8">
          <h2 className="text-xl font-semibold">{s.h2}</h2>
          {s.body.map((p, j) => (
            <p key={j} className="mt-3 text-sm text-muted-foreground">{p}</p>
          ))}
        </section>
      ))}

      {/* Comparison table */}
      {l.table && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold">{l.table.caption}</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2 font-semibold">Pack</th>
                  <th className="px-4 py-2 font-semibold">Price</th>
                  <th className="px-4 py-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {l.table.rows.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-2">{r.pack}</td>
                    <td className="px-4 py-2 font-medium">{r.price}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Buying guide */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold">Buying guide</h2>
        <ol className="mt-3 space-y-3 text-sm">
          {l.buyingGuide.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span className="text-muted-foreground">
                <h3 className="inline text-sm font-semibold text-foreground">Step {i + 1}. </h3>
                {step}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Safety */}
      <section className="mb-8 rounded-xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">Safety & instant delivery</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {l.safety.map((s, i) => (
            <li key={i}>• {s}</li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold">Frequently asked questions</h2>
        <div className="mt-3 space-y-4 text-sm">
          {l.faqs.map((f, i) => (
            <div key={i}>
              <h3 className="font-semibold text-foreground">{f.q}</h3>
              <p className="text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Related links */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold">Related pages</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {l.related.map((r, i) => (
            <li key={i}>
              <a href={r.to} className="text-primary hover:underline">
                {r.label} →
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Final CTA */}
      <section className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-center">
        <h2 className="text-lg font-semibold">Ready to order?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Instant delivery, secure Razorpay checkout, real humans on WhatsApp 24/7.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {product && (
            <Link
              to="/products/$slug"
              params={{ slug: product.slug }}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Buy {product.name} now
            </Link>
          )}
          <Link
            to="/contact"
            className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Talk to support
          </Link>
        </div>
      </section>
    </article>
  );
}

// Force build-time reference so tree-shaking keeps the module.
void SEO_LANDINGS;
