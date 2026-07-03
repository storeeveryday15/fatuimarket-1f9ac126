import { createFileRoute, Link } from "@tanstack/react-router";

const URL = "https://fatuimarket.lovable.app/guides/genshin-impact-top-up";

export const Route = createFileRoute("/guides/genshin-impact-top-up")({
  head: () => ({
    meta: [
      { title: "Genshin Impact Top Up — Buy Genesis Crystals Instantly | Fatui Market" },
      {
        name: "description",
        content:
          "Step-by-step guide to top up Genshin Impact Genesis Crystals fast and safely. Pay via UPI (India, INR) or PayPal / card internationally (USD). Instant delivery, 24/7 support.",
      },
      { property: "og:title", content: "Genshin Impact Top Up — Buy Genesis Crystals Instantly" },
      {
        property: "og:description",
        content:
          "How to buy Genesis Crystals via UPI or PayPal/card. Prices, steps, and safety tips from Fatui Market.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Genshin Impact Top Up — Buy Genesis Crystals Instantly" },
      {
        name: "twitter:description",
        content: "UPI for India, PayPal/card internationally. Instant delivery.",
      },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "How to top up Genshin Impact Genesis Crystals",
          description:
            "Buy Genesis Crystals instantly with UPI in India or PayPal/card internationally through Fatui Market.",
          totalTime: "PT2M",
          step: [
            { "@type": "HowToStep", name: "Find your UID", text: "Open Genshin Impact, tap Paimon menu, and copy your 9-digit UID plus server region." },
            { "@type": "HowToStep", name: "Choose a Crystals pack", text: "Pick the Genesis Crystals denomination that matches your budget." },
            { "@type": "HowToStep", name: "Pay", text: "Indian players scan the dynamic UPI QR. International players pay via PayPal or card in USD." },
            { "@type": "HowToStep", name: "Receive crystals", text: "Submit UTR/transaction ID and screenshot. Crystals are credited to your account after verification, usually within minutes." },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Can I pay with UPI for Genshin Impact top up?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. Indian customers get a dynamic UPI QR code with the exact INR amount pre-filled. Any UPI app (GPay, PhonePe, Paytm, BHIM) works.",
              },
            },
            {
              "@type": "Question",
              name: "How do international players pay?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "International customers can pay in USD via PayPal or credit/debit card at checkout.",
              },
            },
            {
              "@type": "Question",
              name: "How fast is delivery?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Most orders are delivered within a few minutes after payment verification. Our team is available 24/7 on WhatsApp for support.",
              },
            },
            {
              "@type": "Question",
              name: "Is Fatui Market safe for Genshin top ups?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. We only need your UID and server — never your password. Payments use trusted UPI and PayPal rails.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: GenshinGuide,
});

function GenshinGuide() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <nav className="mb-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link> <span className="mx-1">/</span>
        <span>Guides</span> <span className="mx-1">/</span>
        <span className="text-foreground">Genshin Impact Top Up</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Genshin Impact Top Up — Buy Genesis Crystals Instantly
        </h1>
        <p className="mt-3 text-muted-foreground">
          The fastest way to buy Genesis Crystals in India and worldwide. Pay with UPI (INR) or
          PayPal/card (USD), delivered to your account within minutes.
        </p>
      </header>

      <section className="mb-8 rounded-xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">Why top up with Fatui Market</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• <strong className="text-foreground">Instant delivery</strong> after payment verification</li>
          <li>• <strong className="text-foreground">UPI for India</strong> — GPay, PhonePe, Paytm, BHIM (INR)</li>
          <li>• <strong className="text-foreground">PayPal & card</strong> for international players (USD)</li>
          <li>• <strong className="text-foreground">24/7 WhatsApp support</strong> if anything goes wrong</li>
          <li>• Only need your UID + server — never a password</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold">How to top up in 4 steps</h2>
        <ol className="mt-4 space-y-4 text-sm">
          <li>
            <div className="font-semibold text-foreground">1. Find your Genshin UID</div>
            <p className="text-muted-foreground">Open Genshin Impact → tap the Paimon menu → your 9-digit UID is at the bottom-right. Note your server (Asia, America, Europe, TW/HK/MO).</p>
          </li>
          <li>
            <div className="font-semibold text-foreground">2. Choose a Genesis Crystals pack</div>
            <p className="text-muted-foreground">Pick a denomination. Common packs: 60, 300, 980, 1980, 3280, and 6480 Genesis Crystals. Bigger packs give bonus crystals.</p>
          </li>
          <li>
            <div className="font-semibold text-foreground">3. Pay</div>
            <p className="text-muted-foreground">Indian customers scan the auto-generated UPI QR code with the exact INR amount. International customers pay in USD via PayPal or card.</p>
          </li>
          <li>
            <div className="font-semibold text-foreground">4. Submit payment proof</div>
            <p className="text-muted-foreground">Enter your UTR / transaction ID and upload the payment screenshot. Crystals are credited within minutes after verification.</p>
          </li>
        </ol>
      </section>

      <section className="mb-8 rounded-xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">Payment methods</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="font-semibold text-foreground">🇮🇳 India — UPI (INR)</div>
            <p className="mt-1 text-sm text-muted-foreground">Dynamic QR with pre-filled amount. Works with every UPI app. No card, no OTP juggling.</p>
          </div>
          <div>
            <div className="font-semibold text-foreground">🌍 International — USD</div>
            <p className="mt-1 text-sm text-muted-foreground">PayPal and major credit/debit cards. Charged in USD at checkout.</p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold">FAQ</h2>
        <div className="mt-3 space-y-4 text-sm">
          <div>
            <div className="font-semibold text-foreground">Is this an official Genshin Impact top-up?</div>
            <p className="text-muted-foreground">We are an authorized reseller. Crystals are credited to your official HoYoverse account using your UID — no login required.</p>
          </div>
          <div>
            <div className="font-semibold text-foreground">What if my crystals don't arrive?</div>
            <p className="text-muted-foreground">Ping us on WhatsApp with your order code (FM-XXXXXX). We verify and resolve every order manually.</p>
          </div>
          <div>
            <div className="font-semibold text-foreground">Can I get a refund?</div>
            <p className="text-muted-foreground">Yes — if the order can't be fulfilled, we refund in full. See our refund policy.</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-center">
        <h2 className="text-lg font-semibold">Ready to top up?</h2>
        <p className="mt-2 text-sm text-muted-foreground">Get in touch and we'll process your Genesis Crystals order in minutes.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            to="/contact"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Contact us to order
          </Link>
          <Link
            to="/track"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Track an existing order
          </Link>
        </div>
      </section>
    </article>
  );
}
