import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Bot } from "lucide-react";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AiChatWindow } from "@/components/ai-chat-window";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/chats/$threadId")({
  head: () => ({
    meta: [
      { title: "Fatui AI chat — Fatui Market" },
      { name: "description", content: "Continue your Fatui AI conversation about games, events, codes, prices and orders." },
      { property: "og:title", content: "Fatui AI chat" },
      { property: "og:description", content: "Continue your Fatui AI conversation from any device." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatThreadPage,
});

function ChatThreadPage() {
  const { threadId } = Route.useParams();
  const { status, user } = useRequireAuth();
  const [title, setTitle] = useState("Fatui AI");

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void supabase
      .from("assistant_threads")
      .select("title")
      .eq("id", threadId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && data?.title) setTitle(data.title);
      });
    const channel = supabase
      .channel(`thread-meta-${threadId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "assistant_threads", filter: `id=eq.${threadId}` },
        (payload) => setTitle((payload.new as { title: string }).title),
      )
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [threadId, user]);

  if (status !== "authed" || !user) return null;

  return (
    <main className="mx-auto flex h-[calc(100vh-8rem)] w-full max-w-3xl flex-col px-3 py-4">
      <div className="mb-3 flex items-center gap-3">
        <Link to="/chats" className="text-muted-foreground hover:text-foreground" aria-label="Back to chats">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="grid h-8 w-8 place-items-center rounded-full text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
          <Bot className="h-4 w-4" />
        </span>
        <h1 className="truncate text-lg font-semibold">{title}</h1>
      </div>
      <div className="flex-1 overflow-hidden rounded-2xl border border-border/60 bg-card/50">
        <AiChatWindow key={threadId} threadId={threadId} autoTitle />
      </div>
    </main>
  );
}
