// EduFlow service worker: makes the app installable, loads it fast, and shows a friendly
// page when there's no internet. It never stores API responses (your school's data) or
// anything under /api: those always go to the network.
const VERSION = "eduflow-v2";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
// Plain HTML with inline styles: works with nothing else cached
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png"])));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older versions
      for (const key of await caches.keys()) if (!key.startsWith(VERSION)) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

// The page asks a waiting new version to take over ("Refresh" on the update banner)
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Build files have a hash in their name and never change: cache first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/images/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Pages: always try the network first (fresh after every deploy); offline, use the last
  // copy of that page (the app shell, no school data) or the offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(url.pathname, copy));
          }
          return res;
        } catch {
          return (await caches.match(url.pathname)) || (await caches.match(OFFLINE_URL)) || Response.error();
        }
      })()
    );
  }
});
