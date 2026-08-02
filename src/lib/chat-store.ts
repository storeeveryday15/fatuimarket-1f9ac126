/**
 * Unified chat history facade.
 *
 * Signed-in customers read and write cloud history (RLS-scoped, synced across
 * devices). Guests transparently use browser-local storage with the same API,
 * so every screen works for both audiences without branching.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  cacheMessages,
  cachedMessages,
  clearAllThreads,
  createThread,
  deleteThread,
  listMessages,
  listThreads,
  saveMessage,
  updateThread,
  type ChatAttachment,
  type ChatMessage,
  type ChatSource,
  type ChatThread,
} from "@/lib/chat-threads";
import {
  guestClearAll,
  guestCreateThread,
  guestDeleteThread,
  guestExportAll,
  guestGetThread,
  guestListMessages,
  guestListThreads,
  guestSaveMessage,
  guestUpdateThread,
} from "@/lib/guest-chat";

export type { ChatAttachment, ChatMessage, ChatSource, ChatThread };

export async function isSignedIn(): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

export async function storeListThreads(includeArchived = false): Promise<ChatThread[]> {
  return (await isSignedIn()) ? listThreads(includeArchived) : guestListThreads(includeArchived);
}

export async function storeCreateThread(title = "New chat"): Promise<ChatThread | null> {
  return (await isSignedIn()) ? createThread(title) : guestCreateThread(title);
}

export async function storeUpdateThread(id: string, patch: Partial<ChatThread>) {
  if (await isSignedIn()) await updateThread(id, patch);
  else guestUpdateThread(id, patch);
}

export async function storeDeleteThread(id: string) {
  if (await isSignedIn()) await deleteThread(id);
  else guestDeleteThread(id);
}

export async function storeClearAll() {
  if (await isSignedIn()) await clearAllThreads();
  else guestClearAll();
}

export async function storeGetThreadTitle(id: string): Promise<string | null> {
  if (await isSignedIn()) {
    const { data } = await supabase.from("assistant_threads").select("title").eq("id", id).maybeSingle();
    return data?.title ?? null;
  }
  return guestGetThread(id)?.title ?? null;
}

export async function storeListMessages(threadId: string): Promise<ChatMessage[]> {
  return (await isSignedIn()) ? listMessages(threadId) : guestListMessages(threadId);
}

export function storeCachedMessages(threadId: string): ChatMessage[] {
  const local = guestListMessages(threadId);
  return local.length ? local : cachedMessages(threadId);
}

export function storeCacheMessages(threadId: string, messages: ChatMessage[]) {
  cacheMessages(threadId, messages);
}

export async function storeSaveMessage(
  threadId: string,
  role: "user" | "assistant",
  content: string,
  extra?: { attachments?: ChatAttachment[]; sources?: ChatSource[] },
): Promise<ChatMessage | null> {
  if (await isSignedIn()) return saveMessage(threadId, role, content, extra);
  return guestSaveMessage(threadId, role, content, extra);
}

/**
 * Copies every locally stored guest conversation into the signed-in account,
 * then clears the local copy. Runs through the browser client, so RLS keeps
 * the new rows owned by the current user.
 */
export async function importGuestChats(): Promise<{ threads: number; messages: number }> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return { threads: 0, messages: 0 };

  const bundles = guestExportAll();
  let threads = 0;
  let messages = 0;

  for (const { thread, messages: msgs } of bundles) {
    const { data: created, error } = await supabase
      .from("assistant_threads")
      .insert({
        user_id: uid,
        title: thread.title,
        pinned: thread.pinned,
        archived: thread.archived,
        last_message: thread.last_message,
        last_message_at: thread.last_message_at,
      })
      .select("id")
      .single();
    if (error || !created) {
      console.error("[chat] guest import: thread failed", error);
      continue;
    }
    threads += 1;
    if (msgs.length) {
      const rows = msgs.map((m) => ({
        thread_id: created.id,
        user_id: uid,
        role: m.role,
        content: m.content,
        attachments: (m.attachments ?? []) as unknown as never,
        sources: (m.sources ?? []) as unknown as never,
        created_at: m.created_at,
      }));
      const { error: msgErr } = await supabase.from("assistant_thread_messages").insert(rows);
      if (msgErr) console.error("[chat] guest import: messages failed", msgErr);
      else messages += rows.length;
    }
  }

  if (threads > 0) guestClearAll();
  return { threads, messages };
}
