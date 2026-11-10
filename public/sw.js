const CACHE_NAME = "sd-calculator-pwa-__BUILD_VERSION__";
const PRECACHE_MANIFEST = "/precache-manifest.json";
const CORE_FILES = ["/", "/index.html", "/manifest.webmanifest", PRECACHE_MANIFEST];
const CACHE_PREFIX = "sd-calculator-pwa-";

async function fetchAndCache(cache, path) {
  const response = await fetch(path, { cache: "reload" });
  if (!response.ok) throw new Error(`Failed to precache ${path}: HTTP ${response.status}`);
  await cache.put(path, response);
}

async function precacheAllExportedFiles(cache, files) {
  const queue = [...new Set(files)];
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < queue.length) {
      const path = queue[nextIndex++];
      await fetchAndCache(cache, path);
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, queue.length) }, worker));
}

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      // The manifest is generated after the static export and lists every file
      // in out/, including route HTML and chunks that the user has never opened.
      await precacheAllExportedFiles(cache, CORE_FILES);
      const manifestResponse = await cache.match(PRECACHE_MANIFEST);
      if (!manifestResponse) throw new Error("Precache manifest was not cached");
      const manifest = await manifestResponse.json();
      if (!manifest || !Array.isArray(manifest.files) || manifest.files.length === 0) {
        throw new Error("Precache manifest is empty or invalid");
      }
      await precacheAllExportedFiles(cache, manifest.files);
      // Do not force activation while an older app window may contain unsaved input.
      // The browser activates this worker after all clients of the old worker close.
    } catch (error) {
      await caches.delete(CACHE_NAME);
      // Keep the previous worker active if even one exported file cannot be cached.
      throw error;
    }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;

    // Every exported same-origin file should already be cached. This fallback
    // covers late requests and stores successful responses for later offline use.
    try {
      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      if (request.mode === "navigate") {
        const fallback = await cache.match("/") || await cache.match("/index.html");
        if (fallback) return fallback;
      }
      return Response.error();
    }
  })());
});
