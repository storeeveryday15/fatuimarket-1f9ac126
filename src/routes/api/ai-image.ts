import { createFileRoute } from "@tanstack/react-router";

/**
 * Fatui AI image generation and editing.
 *
 * Every request passes a safety review first. If it is rejected the route
 * returns a friendly explanation plus a safe alternative instead of an error,
 * so the chat can guide the customer rather than stonewalling them.
 *
 * Approved requests stream the image back as Server-Sent Events so the chat can
 * show a blurred preview that sharpens into the final picture.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const REVIEW_MODEL = "google/gemini-3.6-flash";
const GENERATE_MODEL = "openai/gpt-image-2";
const EDIT_MODEL = "google/gemini-3.1-flash-image";

const SAFETY_RULES = `You review image requests for a gaming top-up store's assistant.

Reject a request if it asks for any of:
- sexual or nude content, or anything sexualising a minor
- graphic violence, gore or self-harm
- hateful, extremist or harassing imagery
- illegal activity, weapons manufacture or drugs
- impersonating a real identifiable person, or a deepfake meant to deceive
- copyrighted characters, logos or brand artwork (e.g. named game/anime/film characters, studio logos)
- editing a photo of a real person in a misleading way, or identifying who an unknown person is

Otherwise allow it. Original fan-style art, generic heroes, landscapes, wallpapers, avatars, banners,
posters and Fatui Market promo art are all fine.

Reply with JSON only: {"allowed":true} or
{"allowed":false,"reason":"<one friendly sentence>","alternative":"<a concrete safe prompt they could use instead>"}`;

type Body = {
  prompt?: string;
  style?: string;
  mode?: "generate" | "edit";
  image?: string; // data URL of the source image when editing
};

const STYLE_HINTS: Record<string, string> = {
  realistic: "photorealistic, cinematic lighting, high detail",
  anime: "anime illustration, clean line art, vibrant cel shading",
  chibi: "cute chibi style, big head, soft pastel colours",
  pixel: "16-bit pixel art, crisp pixels, retro game palette",
  fantasy: "epic fantasy digital painting, dramatic light, ornate detail",
  cyberpunk: "cyberpunk neon city, rain, teal and magenta glow",
  watercolor: "soft watercolour painting, paper texture, gentle washes",
  poster: "bold promotional poster layout, strong composition, space for text",
};

async function review(prompt: string, key: string, hasImage: boolean) {
  try {
    const res = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: REVIEW_MODEL,
        messages: [
          { role: "system", content: SAFETY_RULES },
          { role: "user", content: `${hasImage ? "Edit request on an uploaded image: " : "Generation request: "}${prompt}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return { allowed: true } as const;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(raw) as { allowed: boolean; reason?: string; alternative?: string };
  } catch {
    return { allowed: true } as const;
  }
}

function blocked(reason: string, alternative?: string) {
  return Response.json(
    {
      blocked: true,
      reason,
      alternative:
        alternative ?? "Try an original character or scene instead — for example a neon-lit fantasy warrior wallpaper.",
    },
    { status: 200 },
  );
}

export const Route = createFileRoute("/api/ai-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Image generation is not configured.", { status: 500 });

        const body = (await request.json()) as Body;
        const prompt = (body.prompt ?? "").trim().slice(0, 1200);
        if (!prompt) return new Response("A prompt is required.", { status: 400 });

        const mode = body.mode === "edit" && body.image ? "edit" : "generate";
        const verdict = await review(prompt, key, mode === "edit");
        if (!verdict.allowed) {
          return blocked(
            verdict.reason ?? "I can't create that one — it falls outside what I'm allowed to make.",
            verdict.alternative,
          );
        }

        const styleHint = body.style ? STYLE_HINTS[body.style] : undefined;
        const fullPrompt = styleHint ? `${prompt}. Style: ${styleHint}.` : prompt;

        const payload =
          mode === "edit"
            ? {
                model: EDIT_MODEL,
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: fullPrompt },
                      { type: "image_url", image_url: { url: body.image } },
                    ],
                  },
                ],
                modalities: ["image", "text"],
                stream: true,
              }
            : {
                model: GENERATE_MODEL,
                prompt: fullPrompt,
                quality: "low",
                size: "1024x1024",
                n: 1,
                stream: true,
                partial_images: 1,
              };

        const upstream = await fetch(`${GATEWAY}/images/generations`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify(payload),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          console.error("[ai-image] upstream error", upstream.status, text);
          if (upstream.status === 429) return new Response("Too many image requests — try again shortly.", { status: 429 });
          if (upstream.status === 402) return new Response("Image generation is temporarily unavailable.", { status: 402 });
          return new Response("The image could not be created. Try rewording your request.", { status: 502 });
        }

        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
