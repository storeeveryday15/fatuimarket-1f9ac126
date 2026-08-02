import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ThemeProvider } from "../components/theme-provider";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";

import { AdsterraBanner2 } from "../components/adsterra-banner-2";
import { ChatWidget } from "../components/chat-widget";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Fatui Market — Instant Game Top-Up & Digital Codes" },
      { name: "description", content: "Instant diamonds, UC, VP, Steam Wallet and Google Play codes. Trusted by gamers worldwide." },
      { name: "author", content: "Fatui Market" },
      { name: "google-site-verification", content: "mmM6_QyH-wOtFJMNuQ2_6X-XEPrS4AHxST5tJXQCsSc" },
      { property: "og:title", content: "Fatui Market — Instant Game Top-Up & Digital Codes" },
      { property: "og:description", content: "Instant diamonds, UC, VP, Steam Wallet and Google Play codes. Trusted by gamers worldwide." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@fatuimarket" },
      { name: "twitter:title", content: "Fatui Market — Instant Game Top-Up & Digital Codes" },
      { name: "twitter:description", content: "Instant diamonds, UC, VP, Steam Wallet and Google Play codes. Trusted by gamers worldwide." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/9CODeXK4U3RTIKwKzCYyfRB4iUp1/social-images/social-1783860883727-64045.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/9CODeXK4U3RTIKwKzCYyfRB4iUp1/social-images/social-1783860883727-64045.webp" },
    ],
    links: [
      { rel: "icon", type: "image/x-icon", href: "/favicon.jpeg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preload", as: "image", href: "/__l5e/assets-v1/d5212832-d4bb-43d2-80da-ee5f8c0d4a0f/fatui-logo.jpeg", fetchpriority: "high" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" },
    ],

    scripts: [{
      async: true,
      src: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7042896613736480",
      crossOrigin: "anonymous",
    }, {
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            name: "Fatui Market",
            url: "https://fatuimarket.lovable.app",
            logo: "https://fatuimarket.lovable.app/__l5e/assets-v1/d5212832-d4bb-43d2-80da-ee5f8c0d4a0f/fatui-logo.jpeg",
            sameAs: [
              "https://www.facebook.com/share/192oekurGU/",
              "https://www.instagram.com/fatuimarket?igsh=bDhvNW44dGUwYXRo",
              "https://t.me/fatuimarket",
            ],
          },
          {
            "@type": "WebSite",
            name: "Fatui Market",
            url: "https://fatuimarket.lovable.app",
          },
        ],
      }),
    }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <div className="flex min-h-screen flex-col bg-background text-foreground">
          <SiteHeader />
          <main className="flex-1">
            <Outlet />
          </main>
          
          <AdsterraBanner2 />
          <SiteFooter />
          <ChatWidget />
          <Toaster richColors position="top-right" />
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
