import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, MessageCircle, Clock, MapPin, Phone, Facebook, Instagram, Send } from "lucide-react";
import {
  WHATSAPP_LINK,
  CONTACT_PHONE,
  CONTACT_EMAIL,
  FACEBOOK_LINK,
  INSTAGRAM_LINK,
  TELEGRAM_LINK,
} from "@/lib/products";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Fatui Market" },
      { name: "description", content: "Get in touch with Fatui Market support via WhatsApp, Facebook, Instagram, Telegram, email or phone." },
      { property: "og:title", content: "Contact — Fatui Market" },
      { property: "og:description", content: "We're here 24/7 to help with your top-up." },
    ],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: "Fatui Market",
        telephone: "+917679393645",
        email: "fatuimarket@gmail.com",
        url: "https://fatuimarket.lovable.app/contact",
        logo: "https://fatuimarket.lovable.app/__l5e/assets-v1/d5212832-d4bb-43d2-80da-ee5f8c0d4a0f/fatui-logo.jpeg",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Dhaka",
          addressCountry: "BD",
        },
        openingHours: "Mo-Su 00:00-23:59",
        sameAs: [
          "https://www.facebook.com/share/192oekurGU/",
          "https://www.instagram.com/fatuimarket?igsh=bDhvNW44dGUwYXRo",
          "https://t.me/fatuimarket",
        ],
      }),
    }],
  }),
  component: Contact,
});

function Contact() {
  const [sent, setSent] = useState(false);
  return (
    <div className="container mx-auto max-w-6xl px-4 py-16">
      <div className="max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--neon)]">Support</span>
        <h1 className="mt-2 text-4xl font-bold md:text-5xl">Talk to us, <span className="gradient-text">anytime</span>.</h1>
        <p className="mt-3 text-muted-foreground">
          Order issue? Payment question? Our support team replies within minutes on WhatsApp.
        </p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <form
          onSubmit={(e) => { e.preventDefault(); setSent(true); }}
          className="surface-card space-y-4 p-6"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" required><input required className="input" placeholder="Your name" /></Field>
            <Field label="Email" required><input required type="email" className="input" placeholder="you@email.com" /></Field>
          </div>
          <Field label="Order ID (optional)"><input className="input" placeholder="#FM-12345" /></Field>
          <Field label="Message" required>
            <textarea required rows={5} className="input resize-none" placeholder="How can we help?" />
          </Field>
          <button className="rounded-xl bg-[image:var(--gradient-primary)] px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
            {sent ? "Message sent ✓" : "Send message"}
          </button>
          {sent && <p className="text-xs text-success">Thanks! We'll reply within 1 hour.</p>}
        </form>

        <div className="grid gap-4 sm:grid-cols-2">
          <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" className="surface-card flex items-start gap-4 p-5 transition-colors hover:bg-secondary/40">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-success/15 text-success"><MessageCircle className="h-6 w-6" /></span>
            <div>
              <div className="font-semibold">WhatsApp</div>
              <div className="text-sm text-muted-foreground">{CONTACT_PHONE}</div>
              <div className="mt-1 text-sm font-medium text-foreground">Chat now →</div>
            </div>
          </a>
          <a href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`} className="surface-card flex items-start gap-4 p-5 transition-colors hover:bg-secondary/40">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary"><Phone className="h-6 w-6" /></span>
            <div>
              <div className="font-semibold">Phone</div>
              <div className="text-sm text-muted-foreground">{CONTACT_PHONE}</div>
              <div className="mt-1 text-sm font-medium text-foreground">Call now →</div>
            </div>
          </a>
          <a href={`mailto:${CONTACT_EMAIL}`} className="surface-card flex items-start gap-4 p-5 transition-colors hover:bg-secondary/40">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-secondary text-foreground"><Mail className="h-6 w-6" /></span>
            <div>
              <div className="font-semibold">Email</div>
              <div className="text-sm text-muted-foreground">{CONTACT_EMAIL}</div>
              <div className="mt-1 text-sm font-medium text-foreground">Send email →</div>
            </div>
          </a>
          <a href={FACEBOOK_LINK} target="_blank" rel="noreferrer" className="surface-card flex items-start gap-4 p-5 transition-colors hover:bg-secondary/40">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#1877F2]/15 text-[#1877F2]"><Facebook className="h-6 w-6" /></span>
            <div>
              <div className="font-semibold">Facebook</div>
              <div className="text-sm text-muted-foreground">Fatui Market</div>
              <div className="mt-1 text-sm font-medium text-foreground">Visit page →</div>
            </div>
          </a>
          <a href={INSTAGRAM_LINK} target="_blank" rel="noreferrer" className="surface-card flex items-start gap-4 p-5 transition-colors hover:bg-secondary/40">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white"><Instagram className="h-6 w-6" /></span>
            <div>
              <div className="font-semibold">Instagram</div>
              <div className="text-sm text-muted-foreground">@everyday_store_official</div>
              <div className="mt-1 text-sm font-medium text-foreground">Follow us →</div>
            </div>
          </a>
          <a href={TELEGRAM_LINK} target="_blank" rel="noreferrer" className="surface-card flex items-start gap-4 p-5 transition-colors hover:bg-secondary/40">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#229ED9]/15 text-[#229ED9]"><Send className="h-6 w-6" /></span>
            <div>
              <div className="font-semibold">Telegram</div>
              <div className="text-sm text-muted-foreground">@fatuimarket</div>
              <div className="mt-1 text-sm font-medium text-foreground">Message us →</div>
            </div>
          </a>
          <div className="surface-card flex items-start gap-4 p-5">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-secondary text-foreground"><Clock className="h-6 w-6" /></span>
            <div>
              <div className="font-semibold">Hours</div>
              <div className="text-sm text-muted-foreground">24 / 7 — including weekends</div>
            </div>
          </div>
          <div className="surface-card flex items-start gap-4 p-5">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-secondary text-foreground"><MapPin className="h-6 w-6" /></span>
            <div>
              <div className="font-semibold">HQ</div>
              <div className="text-sm text-muted-foreground">Dhaka, Bangladesh</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`.input{width:100%;border-radius:.6rem;border:1px solid var(--color-input);background:var(--color-background);padding:.65rem .8rem;font-size:.875rem;color:var(--color-foreground);outline:none}.input:focus{box-shadow:0 0 0 2px var(--color-ring)}`}</style>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}{required && " *"}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
