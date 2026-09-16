/**
 * Emerald does not ship a Service Worker. Komari's default-theme PWA can still
 * register one from `/admin` (scope `/`). A misconfigured navigation fallback
 * may then serve this theme's shell for `/admin` / `/terminal`, which mounts
 * with no matching routes and shows a blank page (#44).
 *
 * Only self-heal when we detect that mismatch. Do not unregister or clear
 * caches on normal theme routes — wiping Cache Storage during boot races with
 * in-flight module loads and can white-screen the homepage.
 */
const RELOAD_FLAG = 'emerald-sw-guard-reload'

function isSystemRoute(pathname: string): boolean {
  return pathname === '/admin'
    || pathname.startsWith('/admin/')
    || pathname === '/terminal'
    || pathname.startsWith('/terminal/')
}

async function clearServiceWorkersAndCaches(): Promise<boolean> {
  if (!('serviceWorker' in navigator))
    return false

  const registrations = await navigator.serviceWorker.getRegistrations()
  if (registrations.length === 0)
    return false

  await Promise.all(registrations.map(reg => reg.unregister()))

  if (typeof caches !== 'undefined') {
    const keys = await caches.keys()
    await Promise.all(keys.map(key => caches.delete(key)))
  }

  return true
}

export async function ensureServiceWorkerDoesNotHijack(): Promise<void> {
  if (!isSystemRoute(location.pathname)) {
    sessionStorage.removeItem(RELOAD_FLAG)
    return
  }

  const cleared = await clearServiceWorkersAndCaches()
  if (!cleared)
    return

  if (sessionStorage.getItem(RELOAD_FLAG)) {
    sessionStorage.removeItem(RELOAD_FLAG)
    console.warn('[SW Guard] Still on a system route after clearing Service Workers; continuing without reload')
    return
  }

  sessionStorage.setItem(RELOAD_FLAG, '1')
  console.warn('[SW Guard] Theme shell loaded on a system route; cleared Service Workers and reloading')
  location.reload()
  await new Promise(() => {})
}
