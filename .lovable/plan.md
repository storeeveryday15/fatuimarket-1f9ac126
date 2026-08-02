# Fatui AI: guest chat history + vision, image generation and editing

Two upgrades to the assistant, built in phases so each one is usable on its own.

## Phase 1 — Guest chat history

- Every visitor gets a stable anonymous guest ID (reusing the existing safe-browser UUID/localStorage helpers, so old Android WebViews don't crash).
- Guest conversations are stored **in the browser only**. Same device = chats restored automatically; cleared browser data or a different device = chats are gone. A short line in the chats UI says this plainly.
- Guests get the same tools as signed-in users: multiple chats, rename, search, pin, archive, delete, export.
- A dismissible banner above the guest chat list: "Sign in to back these up permanently."
- Guest chats untouched for 90 days are pruned automatically on load.
- After sign-in/sign-up, if local guest chats exist, a one-click **"Import my guest chats"** card appears on `/chats`. It copies threads and messages into the account, then clears the local copy. Skipping keeps them local.
- Signed-in users keep unlimited cloud history with real-time sync (already built) — no change to that path.

Note: guest chats will be local-only, not mirrored to a temporary server table. Anonymous server rows would need a public write path with no owner, which weakens the database rules we've already hardened; local storage gives the same "come back on the same device" result with no privacy trade-off.

## Phase 2 — Vision (understanding uploads)

- Chat uploads accept images up to 20 MB and short videos up to 100 MB.
- Signed-in uploads go to the existing private, per-user `chat-uploads` bucket and stay attached to the saved chat. Guest uploads go to a temporary area that is auto-cleaned and never linked to other users.
- Uploaded media is passed to the AI so it can: read text from screenshots (OCR), check top-up receipts, explain game screens and items, help with login/payment errors, identify bugs, and answer follow-up questions about the same file across the conversation.
- People in photos: the AI describes what's visible and answers questions, but will not name unknown real people and will not make misleading edits of them.
- Uploads stay private to the uploader (plus admins for support, as today) and are never shared or used for training.

## Phase 3 — Image generation and editing

- Users can ask for wallpapers, anime art, gaming banners, avatars, logos, social posts and thumbnails directly in chat, with a style picker: realistic, anime, chibi, pixel art, fantasy, cyberpunk, watercolor and more.
- Images stream in progressively (blurred preview sharpening into the final image) so nothing sits on a spinner.
- Editing on an uploaded or generated image: background removal, upscaling, object removal, colour changes, adding text, and Fatui Market poster/banner/ad layouts.
- Results are saved into the chat and downloadable.

## Phase 4 — Safety layer

Before any generation or edit, the request (and any attached image) is screened for: explicit sexual content, anything involving minors, graphic violence, hate/extremism, illegal activity, impersonation, deceptive deepfakes, and copyrighted characters or logos.

Blocked requests get a friendly explanation plus a concrete safe alternative ("I can't make art of that character, but I can do an original red-and-gold armoured hero in the same style") — never a bare refusal. Provider-side rejections are surfaced the same way rather than shown as an error.

## Technical notes

- Guest storage: a `guest-chat` module mirroring the `chat-threads` API shape, so `AiChatWindow` and `/chats` work against either backend behind one interface. Import runs through a server function that inserts threads/messages under the new user with the existing owner-scoped policies.
- Vision: multimodal message parts sent to the gateway chat model; media referenced by signed URL for stored files, inline base64 for guest temporary uploads.
- Generation/editing: a streaming server route under `src/routes/api/` (typed RPC can't stream), forwarding the gateway image stream to the client; the safety screen is a cheap model call in front of it.
- Bucket rules and file-size limits are enforced both client-side and in the upload policy.
- No changes to storefront, checkout, wallet, admin or pricing code.
