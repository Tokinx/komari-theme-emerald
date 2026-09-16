/**
 * Komari serves static files from the active theme before the default theme.
 * Keep this at /sw.js: the admin app registers that URL with scope /.
 *
 * The default worker in Komari 1.5.0 precaches /index.html, which the server
 * renders using the active theme. Its navigation fallback then serves Emerald
 * instead of the default app on /admin and /terminal (#44).
 *
 * Replace that worker without intercepting requests. In particular, navigation
 * must reach Komari so it can select the right app. Do not delete caches or
 * unregister: existing tabs may still need cached assets, and the admin app
 * would register the worker again. Switching themes restores their own sw.js.
 */
globalThis.addEventListener('install', (event) => {
  event.waitUntil(globalThis.skipWaiting())
})

globalThis.addEventListener('activate', (event) => {
  event.waitUntil(globalThis.clients.claim())
})

// Intentionally no fetch handler: HTML, API, plugin and asset requests use
// the network normally. Existing tabs render the correct app on next reload.
