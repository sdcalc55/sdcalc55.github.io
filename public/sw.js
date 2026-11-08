const CACHE_NAME = "sd-calculator-pwa-build";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch("/", { cache: "reload" });
      if (response.ok) await cache.put("/", response.clone());
    } catch {}

    try {
      const manifestResponse = await fetch("/precache-manifest.json", { cache: "no-store" });
      if (manifestResponse.ok) {
        const urls = await manifestResponse.json();
        await cache.put("/precache-manifest.json", manifestResponse.clone());
        await Promise.all(urls.map(async (url) => {
          try {
            const asset = await fetch(url, { cache: "reload" });
            if (asset.ok) await cache.put(url, asset);
          } catch {}
        }));
      }
    } catch {}

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("sd-calculator-pwa-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true }) || await cache.match("/");
      if (cached) {
        event.waitUntil((async () => {
          try {
            const response = await fetch(request, { cache: "no-store" });
            if (response.ok) await cache.put("/", response);
          } catch {}
        })());
        return cached;
      }
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put("/", response.clone());
        return response;
      } catch {
        return new Response("SD | Калькулятор пока не был загружен для автономной работы. Подключитесь к интернету и откройте приложение ещё раз.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })());
    return;
  }

  const isAppAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/fonts/") ||
    /\.(?:png|jpe?g|svg|webp|ico|woff2?|ttf|otf)$/i.test(url.pathname) ||
    url.pathname === "/manifest.webmanifest";

  if (isAppAsset || url.pathname === "/precache-manifest.json") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});
