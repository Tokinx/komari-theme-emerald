# Komari 1.5.0 Service Worker compatibility (#44)

## Cause

Komari selects the active theme for `/index.html`, but serves the default
application for `/admin` and `/terminal`. The old default-theme Workbox worker
precaches `/index.html` and uses it as a navigation fallback. With Emerald active,
that cached document is Emerald, not the administration application.

The upstream fix removes HTML from precaching and sets `navigateFallback: null`:
https://github.com/komari-monitor/komari-web/commit/3324844cfa347f18c83435f1ccf5634df7e5b768

The relevant server routing is in:
https://github.com/komari-monitor/komari/blob/1.5.0/web/public/public.go

## Theme-side compatibility fix

`public/sw.js` is copied to `dist/sw.js` by Vite. Komari prefers the active theme's
static files over the default theme's files, so the default admin app's existing
registration of `/sw.js` now installs this network-only worker at the same URL
and scope. No new registration or Vue startup hook is needed.

`skipWaiting()` replaces the old worker even while other tabs remain open;
`clients.claim()` takes control of existing clients. There is deliberately no
fetch handler, so the server chooses the correct HTML for every route. No Cache
Storage entries or unrelated Service Worker registrations are deleted.

This is a compatibility fallback, not an implementation of offline PWA support:
while Emerald is active, the worker does not cache assets or serve offline pages.
Switching themes lets the existing registration update to that theme's worker.

## Updating an affected browser

Upload the rebuilt theme package and confirm `/sw.js` returns this worker rather
than the bundled Workbox script. Existing installations must update the worker;
an already-rendered blank page is not automatically reloaded. In browser developer
tools, use Application → Service workers → **Update**, wait for activation, then
reload `/admin`. Normal browser update checks can also install the replacement.
If a reverse proxy caches `/sw.js`, invalidate that URL as well.

A theme cannot change a document or worker already stored in a browser until the
browser contacts the server. If the browser is offline, or a proxy keeps serving
the old worker, installing a new theme package alone cannot repair that session.

## Verification checklist

- Reproduce with a worker that caches the active theme's `/index.html` and falls
  back to it for `/admin` and `/terminal`.
- Update the same `/sw.js` registration with this file while multiple tabs remain
  open. Verify replacement activation without manually unregistering.
- Reload `/admin`, a nested admin route, and `/terminal`; all should receive the
  server's default application. `/` and `/instance/:id` should remain Emerald.
- Confirm API/plugin/asset requests reach the server and unrelated cache entries
  survive. A fresh admin registration must also work.
- Run `bun run lint` and `bun run build`; verify the release zip contains
  `dist/sw.js`, `komari-theme.json`, and `preview.png`.
