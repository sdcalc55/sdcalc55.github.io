const CACHE_NAME = "sd-calculator-pwa-__BUILD_VERSION__";
const PRECACHE_MANIFEST = "/precache-manifest.json";
const CORE_FILES = ["/", "/index.html", "/manifest.webmanifest", PRECACHE_MANIFEST];
const CACHE_PREFIX = "sd-calculator-pwa-";

async function fetchAndCache(cache, path) {
  const response = await fetch(path, { cache: "reload" });
  if (!response.ok) throw new Error(`Failed to precache ${path}: HTTP ${response.status}`);
  await cache.put(path, response);
}

async function precacheFiles(cache, files) {
  for (const path of [...new Set(files)]) {
    await fetchAndCache(cache, path);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await precacheFiles(cache, CORE_FILES);
      const manifestResponse = await cache.match(PRECACHE_MANIFEST);
      if (!manifestResponse) throw new Error("Precache manifest was not cached");
      const manifest = await manifestResponse.json();
      if (!manifest || !Array.isArray(manifest.critical) || manifest.critical.length === 0) {
        throw new Error("Critical asset manifest is empty or invalid");
      }
      // Cache only the entry page's essential JS/CSS. Other assets are cached on demand.
      await precacheFiles(cache, manifest.critical);

      await self.skipWaiting();
    } catch (error) {
      await caches.delete(CACHE_NAME);
      // Keep the previous worker active if even one exported file cannot be cached.
      throw error;
    }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Serve the installed app immediately and refresh HTML in the background.
    if (request.mode === "navigate") {
      const cachedPage = await cache.match(request) ||
        await cache.match("/") ||
        await cache.match("/index.html");
      const refreshPage = fetch(request, { cache: "no-cache" }).then(async (response) => {
        if (response.ok && response.type === "basic") await cache.put(request, response.clone());
        return response;
      });
      if (cachedPage) {
        event.waitUntil(refreshPage.catch(() => undefined));
        return cachedPage;
      }
      try {
        return await refreshPage;
      } catch {
        return await cache.match("/") || await cache.match("/index.html") || Response.error();
      }
    }

    // Cache exact URLs; newly requested assets are stored on demand.
    const cached = await cache.match(request);
    if (cached) return cached;
    // A tab may still be running the previous app version. Keep its cached
    // chunks available until that tab reloads safely.
    const previousCaches = (await caches.keys()).filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME);
    for (const previousName of previousCaches) {
      const previousCache = await caches.open(previousName);
      const previousAsset = await previousCache.match(request);
      if (previousAsset) return previousAsset;
    }

    try {
      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());;
});
