// Bump VERSION to drop every cached file on the next visit.
const VERSION = "v3";
const STATIC = `blackbird-static-${VERSION}`; // hashed build files: never change
const PAGES = `blackbird-pages-${VERSION}`; // pages and icons: refreshed whenever online
// the app shell is what must open offline; the public pages are always fresh
const PRECACHE = ["/app", "/icon-192.png", "/icon-512.png"];
const NEVER_CACHE = ["/api/", "/auth/", "/login", "/signup", "/reset", "/profile"];
const LIMITS = { [STATIC]: 250, [PAGES]: 40 };
// bar wifi: past this, open what we have instead of waiting on the network
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC && k !== PAGES).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// keep a cache to its newest entries (Cache keys come back oldest first)
async function trim(name) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  const extra = keys.length - LIMITS[name];
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
}

async function put(name, req, res) {
  if (!res || !res.ok || res.type === "opaque") return;
  const cache = await caches.open(name);
  await cache.put(req, res);
  await trim(name);
}

// hashed build output: the file at a URL never changes, so the cache wins
async function cacheFirst(e) {
  const hit = await caches.match(e.request);
  if (hit) return hit;
  const res = await fetch(e.request);
  e.waitUntil(put(STATIC, e.request, res.clone()));
  return res;
}

// everything else: the network when it answers in time, else the cache;
// a late network answer still refreshes the cache for next time
function networkFirst(e) {
  const req = e.request;
  const network = fetch(req).then((res) => {
    e.waitUntil(put(PAGES, req, res.clone()));
    return res;
  });
  const fallback = async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    // an /app deep link offline: the shell handles the rest
    if (req.mode === "navigate" && new URL(req.url).pathname.startsWith("/app")) {
      const shell = await caches.match("/app");
      if (shell) return shell;
    }
    return null;
  };
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(async () => {
      const hit = await fallback();
      if (hit && !done) {
        done = true;
        resolve(hit);
      }
    }, NETWORK_TIMEOUT_MS);
    network
      .then((res) => {
        clearTimeout(timer);
        if (!done) {
          done = true;
          resolve(res);
        }
      })
      .catch(async (err) => {
        clearTimeout(timer);
        if (done) return;
        const hit = await fallback();
        done = true;
        if (hit) resolve(hit);
        else reject(err);
      });
  });
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  if (e.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some((p) => url.pathname.startsWith(p))) return;
  // React Server Component payloads vary per navigation: leave them alone
  if (url.searchParams.has("_rsc") || e.request.headers.get("RSC")) return;

  if (url.pathname.startsWith("/_next/static/")) e.respondWith(cacheFirst(e));
  else e.respondWith(networkFirst(e));
});
