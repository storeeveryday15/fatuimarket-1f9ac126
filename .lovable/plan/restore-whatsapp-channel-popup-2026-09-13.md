# Restore WhatsApp Channel Popup

## What will change
- Restore the previously deleted WhatsApp Channel popup with its original wording, logo, layout, 900 ms appearance delay, and existing channel link.
- Mount it globally in the same app-level location so it works across mobile and desktop pages.
- Make the X and Close controls dismiss only the current display.
- Make selecting “Don't show again” hide it immediately and suppress it only until the next full page refresh.

## Technical details
- Recreate the former popup component from repository history, using the current official Fatui Market logo asset and shared WhatsApp Channel URL.
- Replace the old persistent local/database preference with module-memory state; no localStorage, cookies, sessionStorage, or database writes.
- Preserve navigation behavior: ordinary closure can allow the popup on a later in-app navigation, while the checkbox blocks it for the remainder of the current loaded page session.
- Verify rendering and interactions at desktop and mobile viewport sizes without changing other site features.
