const CACHE_NAME = "sd-calculator-pwa-v15";
const APP_SHELL = [
  "/", "/manifest.webmanifest",
  "/icons/sd-32.png", "/icons/sd-64.png", "/icons/sd-180.png", "/icons/SD-192.png", "/icons/sd-512.png",
  "/icons/apple-touch-icon-180.png", "/favicon.png", "/favicon.ico",
  "/images/sd-calculator-logo-transparent.webp", "/images/svdemidenko-portrait.webp",
  "/fonts/InterVariable.woff2"
];

async function fetchIntoCache(cache, url, required = false) {
  const response = await fetch(url, { cache: "reload" });
  if (!response.ok) {
    if (required) throw new Error(`Failed to cache app resource: ${url} (${response.status})`);
    return;
  }
  await cache.put(url, response);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      // Download the new app shell completely before allowing this worker to activate.
      const response = await fetch("/", { cache: "reload" });
      if (!response.ok) throw new Error(`Failed to download app shell (${response.status})`);
      await cache.put("/", response.clone());

      const html = await response.text();
      const assets = [...html.matchAll(/(?:src|href)=["']([^"']*\/_next\/static\/[^"']+)["']/g)]
        .map((match) => new URL(match[1], self.location.origin).pathname);
      await Promise.all([...new Set(assets)].map((url) => fetchIntoCache(cache, url, true)));

      // Supporting icons and fonts are cached best-effort; the core HTML and
      // its versioned Next.js assets above are the required offline app shell.
      await Promise.all(APP_SHELL.filter((url) => url !== "/").map((url) => fetchIntoCache(cache, url)));
      await self.skipWaiting();
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith("sd-calculator-pwa-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true }) || await cache.match("/");
      const refreshAppShell = async () => {
        const response = await fetch(request, { cache: "no-store" });
        if (!response.ok) return;
        const html = await response.clone().text();
        const assets = [...html.matchAll(/(?:src|href)=["']([^"']*\/_next\/static\/[^"']+)["']/g)]
          .map((match) => new URL(match[1], self.location.origin).pathname);
        await Promise.all([...new Set(assets)].map(async (assetUrl) => {
          try {
            const asset = await fetch(assetUrl, { cache: "no-store" });
            if (asset.ok) await cache.put(assetUrl, asset);
          } catch {}
        }));
        await cache.put("/", response);
      };
      if (cached) {
        event.waitUntil(refreshAppShell().catch(() => {}));
        return cached;
      }
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put("/", response.clone());
        return response;
      } catch {
        return Response.error();
      }
    })());
    return;
  }
  const isAppAsset = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/") || url.pathname.startsWith("/fonts/") ||
    /\.(?:png|jpe?g|svg|webp|ico|woff2?|ttf|otf)$/i.test(url.pathname) || url.pathname === "/manifest.webmanifest";
  if (isAppAsset) event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(url.pathname, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});
