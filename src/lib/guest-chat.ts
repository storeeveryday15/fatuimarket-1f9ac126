/**
 * Guest (signed-out) chat history — stored in the browser only.
 *
 * Guests get the same features as signed-in customers (multiple chats, rename,
 * pin, archive, search, export, delete) but nothing is written to the server:
 * anonymous rows would need an owner-less public write path, which we do not
 * want. Same device = chats restored; cleared data or another device = gone.
 *
 * Chats untouched for GUEST_TTL_DAYS are pruned automatically on load.
 */

import { safeLocalStorage, safeUUID } from "@/lib/safe-browser";
import type { ChatAttachment, ChatMessage, ChatSource, ChatThread } from "@/lib/chat-threads";

const ID_KEY = "fatui-guest-id";
const THREADS_KEY = "fatui-guest-threads";
const MSG_PREFIX = "fatui-guest-msgs:";
export const GUEST_TTL_DAYS = 90;

/** Attachments larger than this are not persisted (localStorage quota). */
const MAX_PERSISTED_ATTACHMENT = 300_000;

export function guestId(): string {
  let id = safeLocalStorage.getItem(ID_KEY);
  if (!id) {
    id = `guest_${safeUUID()}`;
    safeLocalStorage.setItem(ID_KEY, id);
  }
  return id;
}

function readThreads(): ChatThread[] {
  try {
    const raw = safeLocalStorage.getItem(THREADS_KEY);
    return raw ? (JSON.parse(raw) as ChatThread[]) : [];
  } catch {
    return [];
  }
}

function writeThreads(threads: ChatThread[]) {
  try {
    safeLocalStorage.setItem(THREADS_KEY, JSON.stringify(threads));
  } catch {
    /* storage blocked or full — chat still works for this session */
  }
}

/** Drops guest chats that have been inactive for longer than the TTL. */
function prune(threads: ChatThread[]): ChatThread[] {
  const cutoff = Date.now() - GUEST_TTL_DAYS * 24 * 60 * 60 * 1000;
  const keep: ChatThread[] = [];
  for (const t of threads) {
    if (new Date(t.last_message_at).getTime() >= cutoff) keep.push(t);
    else safeLocalStorage.removeItem(MSG_PREFIX + t.id);
  }
  if (keep.length !== threads.length) writeThreads(keep);
  return keep;
}

export function guestListThreads(includeArchived = false): ChatThread[] {
  const all = prune(readThreads());
  return all
    .filter((t) => (includeArchived ? true : !t.archived))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });
}

export function guestGetThread(id: string): ChatThread | null {
  return readThreads().find((t) => t.id === id) ?? null;
}

export function guestCreateThread(title = "New chat"): ChatThread {
  const now = new Date().toISOString();
  const thread: ChatThread = {
    id: safeUUID(),
    title,
    pinned: false,
    archived: false,
    last_message: null,
    last_message_at: now,
    created_at: now,
  };
  writeThreads([thread, ...readThreads()]);
  return thread;
}

export function guestUpdateThread(id: string, patch: Partial<ChatThread>) {
  writeThreads(readThreads().map((t) => (t.id === id ? { ...t, ...patch } : t)));
}

export function guestDeleteThread(id: string) {
  writeThreads(readThreads().filter((t) => t.id !== id));
  safeLocalStorage.removeItem(MSG_PREFIX + id);
}

export function guestClearAll() {
  for (const t of readThreads()) safeLocalStorage.removeItem(MSG_PREFIX + t.id);
  safeLocalStorage.removeItem(THREADS_KEY);
}

export function guestListMessages(threadId: string): ChatMessage[] {
  try {
    const raw = safeLocalStorage.getItem(MSG_PREFIX + threadId);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

/** Strips inline media that is too large to keep in browser storage. */
function slimAttachments(attachments: ChatAttachment[]): ChatAttachment[] {
  return attachments.map((a) =>
    a.url.length > MAX_PERSISTED_ATTACHMENT ? { ...a, url: "", type: a.type } : a,
  );
}

export function guestSaveMessage(
  threadId: string,
  role: "user" | "assistant",
  content: string,
  extra?: { attachments?: ChatAttachment[]; sources?: ChatSource[] },
): ChatMessage {
  const message: ChatMessage = {
    id: safeUUID(),
    thread_id: threadId,
    role,
    content,
    attachments: extra?.attachments ?? [],
    sources: extra?.sources ?? [],
    created_at: new Date().toISOString(),
  };
  const all = [...guestListMessages(threadId), message].slice(-200);
  try {
    safeLocalStorage.setItem(
      MSG_PREFIX + threadId,
      JSON.stringify(all.map((m) => ({ ...m, attachments: slimAttachments(m.attachments) }))),
    );
  } catch {
    /* quota — keep the in-memory conversation going */
  }
  guestUpdateThread(threadId, {
    last_message: content.slice(0, 200),
    last_message_at: message.created_at,
  });
  return message;
}

export function guestHasChats(): boolean {
  return readThreads().length > 0;
}

/** Everything needed to migrate a guest's chats into a real account. */
export function guestExportAll(): Array<{ thread: ChatThread; messages: ChatMessage[] }> {
  return readThreads().map((thread) => ({ thread, messages: guestListMessages(thread.id) }));
}
