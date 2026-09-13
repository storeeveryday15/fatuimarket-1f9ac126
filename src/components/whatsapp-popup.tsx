import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

import logo from "@/assets/fatui-logo.asset.json";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { WHATSAPP_CHANNEL_LINK } from "@/lib/products";

let hiddenUntilRefresh = false;

export function WhatsappPopup() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hiddenUntilRefresh) return;

    const timer = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const hideUntilRefresh = (checked: boolean) => {
    if (!checked) return;
    hiddenUntilRefresh = true;
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl border-border/60 bg-card/90 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center text-center">
          <img
            src={logo.url}
            alt="Fatui Market"
            width={56}
            height={56}
            decoding="async"
            className="h-14 w-14 rounded-xl object-cover"
          />
          <DialogTitle className="mt-4 text-xl font-bold">
            Join Our WhatsApp Channel
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Get giveaway updates, discounts, restocks and exclusive offers.
          </DialogDescription>

          <Button asChild className="mt-5 h-12 w-full rounded-xl bg-success text-success-foreground hover:bg-success/90">
            <a href={WHATSAPP_CHANNEL_LINK} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
              <MessageCircle className="h-4 w-4" /> Join Channel
            </a>
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
            className="mt-2 h-12 w-full rounded-xl border border-border text-muted-foreground"
          >
            Close
          </Button>

          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              onChange={(event) => hideUntilRefresh(event.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--neon)]"
            />
            Don't show again
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}