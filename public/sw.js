const CACHE_NAME = "sd-calculator-pwa-__BUILD_VERSION__";
const PRECACHE_MANIFEST = "/precache-manifest.json";
const CORE_FILES = ["/", "/index.html", "/manifest.webmanifest", PRECACHE_MANIFEST];
const CACHE_PREFIX = "sd-calculator-pwa-";

async function fetchAndCache(cache, path) {
  const response = await fetch(path, { cache: "reload" });
  if (!response.ok || response.type === "opaque") {
    throw new Error(`Failed to precache ${path}: HTTP ${response.status}`);
  }
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
      // Download the complete new build into its own cache. The current
      // worker and cache remain untouched until every exported file succeeds.
      await precacheFiles(cache, CORE_FILES);
      const manifestResponse = await cache.match(PRECACHE_MANIFEST);
      if (!manifestResponse) throw new Error("Precache manifest was not cached");
      const manifest = await manifestResponse.json();
      if (!manifest || !Array.isArray(manifest.files) || manifest.files.length === 0 ||
          !Array.isArray(manifest.critical) || manifest.critical.length === 0) {
        throw new Error("Precache manifest is empty or invalid");
      }
      await precacheFiles(cache, manifest.files);

      // Validate that the new app entry point and every critical asset exist.
      for (const path of ["/", "/index.html", ...manifest.critical]) {
        if (!await cache.match(path)) throw new Error(`Missing cached app asset: ${path}`);
      }
      await self.skipWaiting();
    } catch (error) {
      await caches.delete(CACHE_NAME);
      // Failed or offline update: retain the previously active version.
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

    // Cache-first navigation gives the installed app a fast, offline launch.
    // The network refresh is non-blocking and only refreshes this version's
    // page cache; installation of a newer build happens in a separate cache.
    if (request.mode === "navigate") {
      const cachedPage = await cache.match(request) ||
        await cache.match("/") ||
        await cache.match("/index.html");
      const refreshPage = fetch(request, { cache: "no-cache" }).then(async (response) => {
        if (response.ok && response.type === "basic") {
          await cache.put(request, response.clone());
        }
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

    const cached = await cache.match(request);
    if (cached) return cached;

    // Keep old hashed chunks available to already-open tabs until they reload.
    const previousCaches = (await caches.keys()).filter(
      (key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME
    );
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
  })());
});
