import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LogIn, UserPlus } from "lucide-react";
import { z } from "zod";

type AuthSearch = { redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Fatui Market" },
      { name: "description", content: "Sign in or create a Fatui Market account to shop, track orders, and view payment history." },
    ],
  }),
  component: AuthPage,
});

async function claimAdmin() {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/public/claim-admin", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
  } catch { /* ignore */ }
}

const signUpSchema = z.object({
  username: z.string().trim().min(3, "Username must be 3+ chars").max(24).regex(/^[a-zA-Z0-9_.-]+$/, "Letters, numbers, _ . - only"),
  email: z.string().trim().email("Invalid email").max(254),
  password: z.string().min(6, "Password must be 6+ chars").max(128),
});

function AuthPage() {
  const search = useSearch({ from: "/auth" }) as AuthSearch;
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        await claimAdmin();
        navigate({ to: search.redirect ?? "/" });
      }
    });
  }, [navigate, search.redirect]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const cleanEmail = email.trim();
        if (!cleanEmail) throw new Error("Enter your email");
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your email for a reset link.");
        setMode("signin");
      } else if (mode === "signup") {
        const parsed = signUpSchema.safeParse({ username, email, password });
        if (!parsed.success) throw new Error(parsed.error.issues[0].message);
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}${search.redirect ?? "/"}`,
            data: { username: parsed.data.username, display_name: parsed.data.username },
          },
        });
        if (error) throw error;
        toast.success("Account created! You're signed in.");
        await claimAdmin();
        navigate({ to: search.redirect ?? "/" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        toast.success("Welcome back!");
        await claimAdmin();
        navigate({ to: search.redirect ?? "/" });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-md px-4 py-16">
      <div className="surface-card p-8">
        {mode !== "forgot" && (
          <div className="mb-6 flex gap-2 rounded-xl bg-secondary p-1">
            <button type="button" onClick={() => setMode("signin")} className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${mode === "signin" ? "bg-background text-foreground shadow" : "text-muted-foreground"}`}>Sign in</button>
            <button type="button" onClick={() => setMode("signup")} className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${mode === "signup" ? "bg-background text-foreground shadow" : "text-muted-foreground"}`}>Create account</button>
          </div>
        )}
        <h1 className="text-2xl font-bold">
          {mode === "signin" ? "Welcome back" : mode === "signup" ? "Join Fatui Market" : "Reset your password"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signup"
            ? "You need an account to browse and order."
            : mode === "forgot"
              ? "Enter your email and we'll send you a reset link."
              : "Sign in to continue shopping."}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="yourname" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@email.com" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          {mode !== "forgot" && (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                {mode === "signin" && (
                  <button type="button" onClick={() => setMode("forgot")} className="text-xs font-medium text-primary underline">
                    Forgot password?
                  </button>
                )}
              </div>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          )}
          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-60">
            {mode === "signin" ? <LogIn className="h-4 w-4" /> : mode === "signup" ? <UserPlus className="h-4 w-4" /> : null}
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </button>
          {mode === "forgot" && (
            <button type="button" onClick={() => setMode("signin")} className="w-full text-center text-xs font-medium text-muted-foreground underline">
              Back to sign in
            </button>
          )}
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our <Link to="/terms" className="underline">Terms</Link> & <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
