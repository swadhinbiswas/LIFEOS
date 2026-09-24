/*
 * LifeOS service worker (MVP #29, ADR-055).
 *
 * Narrow by design:
 *  - navigations: network-first, so online always sees fresh HTML and offline falls back to the
 *    last rendered shell;
 *  - immutable static assets (/_next/static, fonts, images): cache-first;
 *  - everything else — server actions (POST), /api, RSC fetches — passes straight through and is
 *    never cached, so no write or live query is ever served stale.
 */
const VERSION = "lifeos-v1";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const MAX_PAGES = 30;

const isStatic = (pathname) =>
  pathname.startsWith("/_next/static/") ||
  /\.(?:css|js|woff2?|png|svg|ico|webp|avif)$/.test(pathname);

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((key) => cache.delete(key)));
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(PAGE_CACHE);
          await cache.put(request, response.clone());
          await trim(PAGE_CACHE, MAX_PAGES);
          return response;
        } catch {
          return (
            (await caches.match(request)) || (await caches.match("/dashboard")) || Response.error()
          );
        }
      })(),
    );
    return;
  }

  if (isStatic(url.pathname)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(STATIC_CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      })(),
    );
  }
});
