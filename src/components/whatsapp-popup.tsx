import { useEffect, useState } from "react";
import { X, MessageCircle } from "lucide-react";
import logo from "@/assets/logo.png";
import { WHATSAPP_CHANNEL_LINK } from "@/lib/products";
import { supabase } from "@/integrations/supabase/client";

const LS_KEY = "fm_hide_whatsapp_popup";

export function WhatsappPopup() {
  const [open, setOpen] = useState(false);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined") return;
      if (localStorage.getItem(LS_KEY) === "1") return;
      // Also check profile.hide_popup for logged-in users
      try {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          const { data: p } = await supabase.from("profiles").select("hide_popup").eq("id", u.user.id).maybeSingle();
          if ((p as { hide_popup?: boolean } | null)?.hide_popup) {
            localStorage.setItem(LS_KEY, "1");
            return;
          }
        }
      } catch { /* ignore */ }
      const t = setTimeout(() => setOpen(true), 900);
      return () => clearTimeout(t);
    })();
  }, []);

  const close = async () => {
    if (dontShow) {
      localStorage.setItem(LS_KEY, "1");
      try {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) await supabase.from("profiles").update({ hide_popup: true } as never).eq("id", u.user.id);
      } catch { /* ignore */ }
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <button aria-label="Close" onClick={close} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <div className="relative w-full max-w-md rounded-2xl border border-border/60 bg-card/90 p-6 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-300">
        <button onClick={close} className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="flex flex-col items-center text-center">
          <img src={logo} alt="Fatui Market" className="h-14 w-14 rounded-xl" />
          <h2 className="mt-4 text-xl font-bold">Join Our WhatsApp Channel</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Get giveaway updates, discounts, restocks and exclusive offers.
          </p>
          <a
            href={WHATSAPP_CHANNEL_LINK}
            target="_blank"
            rel="noreferrer"
            onClick={close}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#1ebe57]"
          >
            <MessageCircle className="h-4 w-4" /> Join Channel
          </a>
          <button onClick={close} className="mt-2 w-full rounded-xl border border-border bg-secondary px-5 py-3 text-sm font-semibold text-muted-foreground hover:bg-secondary/70">
            Close
          </button>
          <label className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--neon)]" />
            Don't show again
          </label>
        </div>
      </div>
    </div>
  );
}
