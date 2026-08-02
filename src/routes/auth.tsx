import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Mail, ArrowLeft, KeyRound } from "lucide-react";
import { z } from "zod";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type AuthSearch = { redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Fatui Market" },
      { name: "description", content: "Sign in to Fatui Market with Google or a one-time email code. Fast, secure access to orders, wallet, and rewards." },
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

const emailSchema = z.string().trim().email("Enter a valid email").max(254);
const OTP_LENGTH = 8;
const otpSchema = z
  .string()
  .regex(/^\d{6,8}$/, "Enter the verification code from your email");

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1a6.2 6.2 0 1 1 0-12.4 5.6 5.6 0 0 1 3.95 1.54l2.7-2.6A9.7 9.7 0 0 0 12 2a10 10 0 1 0 0 20c5.77 0 9.6-4.05 9.6-9.76 0-.66-.07-1.16-.16-1.66Z"/>
      <path fill="#FBBC05" d="M3.88 7.34l3.2 2.34A5.2 5.2 0 0 1 12 6.6a5.6 5.6 0 0 1 3.95 1.54l2.7-2.6A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.12 5.34Z"/>
      <path fill="#34A853" d="M12 22a9.7 9.7 0 0 0 6.72-2.44l-3.1-2.55A5.9 5.9 0 0 1 12 18.2a6.2 6.2 0 0 1-5.84-4.14L3 16.46A10 10 0 0 0 12 22Z"/>
      <path fill="#4285F4" d="M21.6 12.24c0-.66-.07-1.16-.16-1.66H12v3.9h5.5a4.7 4.7 0 0 1-2 3.07l3.1 2.55c1.8-1.66 3-4.14 3-7.86Z"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#1877F2" d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.5-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12Z"/>
    </svg>
  );
}

function AuthPage() {
  const search = useSearch({ from: "/auth" }) as AuthSearch;
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        await claimAdmin();
        navigate({ to: search.redirect ?? "/" });
      }
    });
  }, [navigate, search.redirect]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const parsed = emailSchema.safeParse(email);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const { error } = await supabase.auth.signInWithOtp({
        email: parsed.data,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}${search.redirect ?? "/"}`,
        },
      });
      if (error) throw error;
      toast.success("We sent a verification code to your email.");
      setStep("otp");
      setResendIn(45);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const parsed = otpSchema.safeParse(otp);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: parsed.data,
        type: "email",
      });
      if (error) throw error;
      toast.success("Signed in!");
      await claimAdmin();
      navigate({ to: search.redirect ?? "/" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  const signInGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error instanceof Error ? result.error : new Error(String(result.error));
      if (result.redirected) return;
      await claimAdmin();
      navigate({ to: search.redirect ?? "/" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const notifyFacebookUnavailable = () => {
    toast.info("Facebook login is coming soon. Please use Google or email code for now.");
  };

  return (
    <div className="container mx-auto max-w-md px-4 py-16">
      <div className="surface-card p-8">
        <h1 className="text-2xl font-bold">
          {step === "email" ? "Welcome to Fatui Market" : "Enter your code"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === "email"
            ? "Sign in with Google or get a one-time code by email."
            : `We sent a verification code to ${email}. It expires in 10 minutes.`}
        </p>

        {step === "email" && (
          <>
            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                onClick={signInGoogle}
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-secondary hover:shadow-[var(--shadow-glow)] disabled:opacity-60"
              >
                <GoogleIcon />
                Continue with Google
              </button>
              <button
                type="button"
                onClick={notifyFacebookUnavailable}
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-secondary disabled:opacity-60"
              >
                <FacebookIcon />
                Continue with Facebook
              </button>
            </div>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={sendCode} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <div className="relative mt-1">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@email.com"
                    className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-60"
              >
                <KeyRound className="h-4 w-4" />
                {loading ? "Sending…" : "Send verification code"}
              </button>
            </form>
          </>
        )}

        {step === "otp" && (
          <form onSubmit={verifyCode} className="mt-6 space-y-5">
            <div className="flex justify-center">
              <InputOTP maxLength={OTP_LENGTH} value={otp} onChange={setOtp} autoFocus>
                <InputOTPGroup>
                  {Array.from({ length: OTP_LENGTH }, (_, i) => i).map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="h-11 w-9 text-base font-bold sm:h-12 sm:w-10 sm:text-lg"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-60"
            >
              {loading ? "Verifying…" : "Verify & continue"}
            </button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => { setStep("email"); setOtp(""); }}
                className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" /> Change email
              </button>
              <button
                type="button"
                onClick={() => sendCode()}
                disabled={resendIn > 0 || loading}
                className="font-semibold text-primary underline disabled:no-underline disabled:opacity-60"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our <Link to="/terms" className="underline">Terms</Link> & <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
