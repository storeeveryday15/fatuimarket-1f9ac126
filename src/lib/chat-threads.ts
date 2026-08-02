/**
 * Persistent Fatui AI chat history for signed-in customers.
 *
 * All reads and writes go through the browser Supabase client, so RLS keeps
 * every conversation scoped to its owner. Guests keep the old session-only
 * behaviour and nothing is written to the database for them.
 */

import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/lib/safe-browser";

export type ChatThread = {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  last_message: string | null;
  last_message_at: string;
  created_at: string;
};

export type ChatAttachment = { url: string; name: string; type: string };
export type ChatSource = { title: string; url: string; trust: "official" | "community" | "other" };

export type ChatMessage = {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  attachments: ChatAttachment[];
  sources: ChatSource[];
  created_at: string;
};

const CACHE_PREFIX = "fatui-chat-cache:";

/** Fast local cache so a returning device paints instantly before the fetch lands. */
export function cachedMessages(threadId: string): ChatMessage[] {
  try {
    const raw = safeLocalStorage.getItem(CACHE_PREFIX + threadId);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export function cacheMessages(threadId: string, messages: ChatMessage[]) {
  try {
    safeLocalStorage.setItem(CACHE_PREFIX + threadId, JSON.stringify(messages.slice(-40)));
  } catch {
    /* storage may be blocked */
  }
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function historyEnabled(): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const { data } = await supabase.from("profiles").select("ai_history_enabled").eq("id", uid).maybeSingle();
  return data?.ai_history_enabled !== false;
}

export async function setHistoryEnabled(enabled: boolean) {
  const uid = await currentUserId();
  if (!uid) return;
  await supabase.from("profiles").update({ ai_history_enabled: enabled }).eq("id", uid);
}

export async function listThreads(includeArchived = false): Promise<ChatThread[]> {
  let q = supabase
    .from("assistant_threads")
    .select("id,title,pinned,archived,last_message,last_message_at,created_at")
    .order("pinned", { ascending: false })
    .order("last_message_at", { ascending: false })
    .limit(200);
  if (!includeArchived) q = q.eq("archived", false);
  const { data } = await q;
  return (data ?? []) as ChatThread[];
}

export async function createThread(title = "New chat"): Promise<ChatThread | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from("assistant_threads")
    .insert({ user_id: uid, title })
    .select("id,title,pinned,archived,last_message,last_message_at,created_at")
    .single();
  if (error) {
    console.error("[chat] create thread failed", error);
    return null;
  }
  return data as ChatThread;
}

export async function updateThread(id: string, patch: Partial<Pick<ChatThread, "title" | "pinned" | "archived">>) {
  const { error } = await supabase.from("assistant_threads").update(patch).eq("id", id);
  if (error) console.error("[chat] update thread failed", error);
}

export async function deleteThread(id: string) {
  const { error } = await supabase.from("assistant_threads").delete().eq("id", id);
  if (error) console.error("[chat] delete thread failed", error);
}

export async function clearAllThreads() {
  const uid = await currentUserId();
  if (!uid) return;
  const { error } = await supabase.from("assistant_threads").delete().eq("user_id", uid);
  if (error) console.error("[chat] clear history failed", error);
}

export async function listMessages(threadId: string): Promise<ChatMessage[]> {
  const { data } = await supabase
    .from("assistant_thread_messages")
    .select("id,thread_id,role,content,attachments,sources,created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(500);
  const rows = (data ?? []) as unknown as ChatMessage[];
  cacheMessages(threadId, rows);
  return rows;
}

export async function saveMessage(
  threadId: string,
  role: "user" | "assistant",
  content: string,
  extra?: { attachments?: ChatAttachment[]; sources?: ChatSource[] },
): Promise<ChatMessage | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from("assistant_thread_messages")
    .insert({
      thread_id: threadId,
      user_id: uid,
      role,
      content,
      attachments: (extra?.attachments ?? []) as unknown as never,
      sources: (extra?.sources ?? []) as unknown as never,
    })
    .select("id,thread_id,role,content,attachments,sources,created_at")
    .single();
  if (error) {
    console.error("[chat] save message failed", error);
    return null;
  }
  await supabase
    .from("assistant_threads")
    .update({ last_message: content.slice(0, 200), last_message_at: new Date().toISOString() })
    .eq("id", threadId);
  return data as unknown as ChatMessage;
}

/** Plain-text export of one conversation. */
export function exportThread(thread: ChatThread, messages: ChatMessage[]): string {
  const lines = [
    `Fatui AI — ${thread.title}`,
    `Started ${new Date(thread.created_at).toLocaleString()}`,
    "",
    ...messages.map((m) => `[${new Date(m.created_at).toLocaleString()}] ${m.role === "user" ? "You" : "Fatui AI"}:\n${m.content}\n`),
  ];
  return lines.join("\n");
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
