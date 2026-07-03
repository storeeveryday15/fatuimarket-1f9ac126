import { Link, useNavigate } from "@tanstack/react-router";
import { Moon, Sun, Menu, X, LogOut, LayoutDashboard, Shield, LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "./theme-provider";
import { cn } from "@/lib/utils";
import { LOGO_URL } from "@/lib/products";
import { supabase } from "@/integrations/supabase/client";
import { LiveVisitors } from "@/components/live-visitors";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/track", label: "Track Order" },
  { to: "/contact", label: "Contact" },
  { to: "/refund", label: "Refund" },
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
] as const;

export function SiteHeader() {
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
      if (data.user) {
        supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle()
          .then(({ data }) => setIsAdmin(!!data));
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
      if (!session) setIsAdmin(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <img src={LOGO_URL} alt="Fatui Market logo" className="h-9 w-9 rounded-xl object-cover shadow-[var(--shadow-glow)]" />
          <span>
            Fatui<span className="gradient-text"> Market</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "text-foreground bg-secondary" }}
            >
              {n.label}
            </Link>
          ))}
          {userEmail && (
            <Link to="/dashboard" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground inline-flex items-center gap-1.5">
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Link>
          )}
          {isAdmin && (
            <Link to="/admin" className="rounded-md px-3 py-2 text-sm font-medium text-[var(--neon)] hover:bg-secondary inline-flex items-center gap-1.5">
              <Shield className="h-4 w-4" /> Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block"><LiveVisitors /></div>
          {userEmail ? (
            <button
              onClick={signOut}
              className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          ) : (
            <Link
              to="/auth"
              className="hidden md:inline-flex items-center gap-1.5 rounded-lg bg-[image:var(--gradient-primary)] px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <LogIn className="h-3.5 w-3.5" /> Sign in
            </Link>
          )}
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-secondary"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-foreground md:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className={cn("md:hidden", open ? "block" : "hidden")}>
        <nav className="container mx-auto flex max-w-7xl flex-col gap-1 px-4 pb-4">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "text-foreground bg-secondary" }}
            >
              {n.label}
            </Link>
          ))}
          {userEmail ? (
            <>
              <Link to="/dashboard" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary">Dashboard</Link>
              {isAdmin && <Link to="/admin" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-[var(--neon)] hover:bg-secondary">Admin</Link>}
              <button onClick={() => { setOpen(false); signOut(); }} className="text-left rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary">Sign out</button>
            </>
          ) : (
            <Link to="/auth" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-[var(--neon)] hover:bg-secondary">Sign in / Sign up</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
