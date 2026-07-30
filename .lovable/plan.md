## What's actually broken

Reproduced in a real browser session at `/admin/notifications`. The page throws:

```text
Error: cannot add `postgres_changes` callbacks for realtime:realtime:admin_notifications
after `subscribe()`.   at src/hooks/use-realtime-table.ts
```

The error escapes to the root error boundary in `src/routes/__root.tsx`, which renders "This page didn't load".

Cause: the admin layout renders `NotificationBell`, and the page renders `NotificationCenter`. Both call `useRealtimeTable("admin_notifications")`, and that hook always names its channel `realtime:<table>`. Supabase-js returns the already-subscribed channel for that topic, and calling `.on("postgres_changes", ...)` on an already-subscribed channel throws. Opening the bell popover (a third mount) makes it worse. Same latent bug exists anywhere two components watch the same table.

Ruled out: the `admin_notifications` table exists, RLS is a correct admin-only policy, SSR of the route returns 200, imports and the route file are fine, and an empty table is not the trigger.

## Fix

1. `src/hooks/use-realtime-table.ts`
   - Give every hook instance a unique channel topic (`realtime:<table>:<useId()/random>`) so two components never collide on one channel.
   - Wrap the initial fetch and the channel setup/teardown in try/catch; on failure set an error message, `console.error` it, and still leave the hook in a resolved (non-loading) state so the UI renders instead of throwing.
   - Handle subscribe status callbacks (`CHANNEL_ERROR`, `TIMED_OUT`) by logging and degrading to the already-fetched data — no throw.
   - Never leave `rows` as `null` after a failed fetch (use `[]`) so consumers show the empty state, not a crash.

2. `src/components/admin/notification-center.tsx`
   - Defensive rendering: tolerate null/undefined `title`, `body`, `type`, and unknown `severity`.
   - Keep the existing loading state, keep "No notifications yet" for the empty case, and add a small non-fatal banner when `error` is set ("Live updates unavailable — showing last loaded data").
   - `markRead` / `markAllRead`: surface errors via `console.error` + a toast instead of silently failing.
   - `NotificationBell`: badge computed defensively from a possibly-empty list.

3. `src/routes/admin/notifications.tsx`
   - Add a route-level `errorComponent` (and `notFoundComponent`) so any future failure in this subtree renders a contained retry card instead of blanking the whole app via the root boundary.
   - Add a page `head()` with a proper title/description.

No database migration is needed — schema, grants and RLS are already correct.

## Verification

Re-run the authenticated browser check on `/admin/notifications`: the page must render the list (or the empty state) with zero page errors, and opening the bell popover while on the notifications page must not throw.
