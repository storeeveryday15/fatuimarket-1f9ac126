import { flushSync } from "react-dom";

/**
 * Client helper for the streaming image endpoint.
 *
 * Handles both outcomes of /api/ai-image: a JSON safety rejection (returned as
 * `blocked`) and an SSE image stream (partial previews then the final image).
 */

export type ImageStyle =
  | "realistic"
  | "anime"
  | "chibi"
  | "pixel"
  | "fantasy"
  | "cyberpunk"
  | "watercolor"
  | "poster";

export const IMAGE_STYLES: Array<{ id: ImageStyle; label: string }> = [
  { id: "realistic", label: "Realistic" },
  { id: "anime", label: "Anime" },
  { id: "chibi", label: "Chibi" },
  { id: "pixel", label: "Pixel art" },
  { id: "fantasy", label: "Fantasy" },
  { id: "cyberpunk", label: "Cyberpunk" },
  { id: "watercolor", label: "Watercolour" },
  { id: "poster", label: "Poster / banner" },
];

type Payload =
  | { type: "image_generation.partial_image"; b64_json: string }
  | { type: "image_generation.completed"; b64_json: string }
  | { type: "error"; error?: { message?: string } };

export type ImageResult =
  | { kind: "image"; dataUrl: string }
  | { kind: "blocked"; reason: string; alternative: string };

/** Streams an image, calling `onFrame` for every preview and the final frame. */
export async function streamImage(
  req: { prompt: string; style?: ImageStyle; mode?: "generate" | "edit"; image?: string },
  onFrame: (dataUrl: string, isFinal: boolean) => void,
): Promise<ImageResult> {
  const res = await fetch("/api/ai-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await res.json()) as { blocked?: boolean; reason?: string; alternative?: string };
    if (json.blocked) {
      return {
        kind: "blocked",
        reason: json.reason ?? "I can't create that one.",
        alternative: json.alternative ?? "Try describing an original character or scene instead.",
      };
    }
  }
  if (!res.ok || !res.body) {
    throw new Error((await res.text().catch(() => "")) || "The image could not be created.");
  }

  let last = "";
  let done = false;
  let streamError: string | undefined;
  let buffer = "";

  const handle = (block: string) => {
    let event = "";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    const data = dataLines.join("\n");
    if (!data || data === "[DONE]") return;
    let payload: Payload | undefined;
    try {
      payload = JSON.parse(data) as Payload;
    } catch {
      return;
    }
    if (event === "error" || payload.type === "error") {
      streamError = payload.type === "error" ? (payload.error?.message ?? "Image generation failed") : "Image generation failed";
      return;
    }
    if (!("b64_json" in payload) || !payload.b64_json) return;
    const isFinal = payload.type === "image_generation.completed" || event === "image_generation.completed";
    last = `data:image/png;base64,${payload.b64_json}`;
    if (isFinal) done = true;
    flushSync(() => onFrame(last, isFinal));
  };

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    for (;;) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      buffer += value;
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? "";
      for (const part of parts) handle(part);
    }
    if (buffer.trim()) handle(buffer);
  } finally {
    void reader.cancel().catch(() => {});
  }

  if (streamError) throw new Error(streamError);
  if (!last) throw new Error("The image stream ended before an image arrived.");
  if (!done) onFrame(last, true);
  return { kind: "image", dataUrl: last };
}
