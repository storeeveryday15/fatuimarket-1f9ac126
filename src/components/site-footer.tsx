import { Link } from "@tanstack/react-router";
import { MessageCircle, Mail, Shield, Phone, Facebook, Instagram, Send } from "lucide-react";
import {
  LOGO_URL,
  WHATSAPP_LINK,
  CONTACT_PHONE,
  CONTACT_EMAIL,
  FACEBOOK_LINK,
  INSTAGRAM_LINK,
  TELEGRAM_LINK,
} from "@/lib/products";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-card/40">
      <div className="container mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <img src={LOGO_URL} alt="Fatui Market" width={36} height={36} loading="lazy" decoding="async" className="h-9 w-9 rounded-xl object-cover" />
            Fatui Market
          </div>
          <p className="text-sm text-muted-foreground">
            Instant game top-ups & digital codes. Trusted by gamers worldwide.
          </p>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold">Products</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/products/$slug" params={{ slug: "mobile-legends" }} className="hover:text-foreground">Mobile Legends</Link></li>
            <li><Link to="/products/$slug" params={{ slug: "free-fire" }} className="hover:text-foreground">Free Fire</Link></li>
            <li><Link to="/products/$slug" params={{ slug: "pubg-mobile" }} className="hover:text-foreground">PUBG Mobile</Link></li>
            <li><Link to="/products/$slug" params={{ slug: "valorant" }} className="hover:text-foreground">Valorant</Link></li>
            <li><Link to="/products/$slug" params={{ slug: "steam-wallet" }} className="hover:text-foreground">Steam Wallet</Link></li>
            <li><Link to="/products/$slug" params={{ slug: "google-play" }} className="hover:text-foreground">Google Play</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold">Legal</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/dashboard" className="hover:text-foreground">My orders</Link></li>
            <li><Link to="/terms" className="hover:text-foreground">Terms & Conditions</Link></li>
            <li><Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
            <li><Link to="/refund" className="hover:text-foreground">Refund Policy</Link></li>
            <li><Link to="/contact" className="hover:text-foreground">Contact</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold">Customer Support</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>
              <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-foreground">
                <MessageCircle className="h-4 w-4 text-success" /> WhatsApp 24/7
              </a>
            </li>
            <li>
              <a href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 hover:text-foreground">
                <Phone className="h-4 w-4" /> {CONTACT_PHONE}
              </a>
            </li>
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-2 hover:text-foreground">
                <Mail className="h-4 w-4" /> {CONTACT_EMAIL}
              </a>
            </li>
            <li className="inline-flex items-center gap-2">
              <Shield className="h-4 w-4" /> Secure payments
            </li>
          </ul>
          <div className="mt-4 flex items-center gap-3">
            <a href={FACEBOOK_LINK} target="_blank" rel="noreferrer" aria-label="Facebook" className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground transition-colors hover:bg-[#1877F2] hover:text-white">
              <Facebook className="h-4 w-4" />
            </a>
            <a href={INSTAGRAM_LINK} target="_blank" rel="noreferrer" aria-label="Instagram" className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground transition-colors hover:bg-gradient-to-br hover:from-purple-500 hover:via-pink-500 hover:to-orange-400 hover:text-white">
              <Instagram className="h-4 w-4" />
            </a>
            <a href={TELEGRAM_LINK} target="_blank" rel="noreferrer" aria-label="Telegram" className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground transition-colors hover:bg-[#229ED9] hover:text-white">
              <Send className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Fatui Market. All trademarks belong to their respective owners.
      </div>
    </footer>
  );
}
