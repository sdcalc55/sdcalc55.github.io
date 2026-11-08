const CACHE_NAME = "sd-calculator-pwa-v12";
const APP_SHELL = [
  "/", "/manifest.webmanifest",
  "/icons/sd-32.png", "/icons/sd-64.png", "/icons/sd-192.png", "/icons/sd-512.png",
  "/icons/apple-touch-icon-180.png", "/favicon.png", "/favicon.ico",
  "/images/sd-calculator-logo-transparent.png", "/images/sd-calculator-logo-transparent.svg",
  "/images/social-max.svg", "/images/social-telegram.svg", "/images/social-vk.svg", "/images/svdemidenko-portrait.webp",
  "/og-preview.png", "/og-preview-128.png", "/og-preview-256.png", "/og-preview-small.png", "/og-preview.svg",
  "/fonts/InterVariable.woff2", "/fonts/MontserratVariable.ttf", "/fonts/OnestVariable.ttf"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch("/", { cache: "reload" });
      if (response.ok) {
        await cache.put("/", response.clone());
        const html = await response.text();
        const assets = [...html.matchAll(/(?:src|href)=["']([^"']*\/_next\/static\/[^"']+)["']/g)].map((match) => new URL(match[1], self.location.origin).pathname);
        await Promise.all([...new Set(assets)].map(async (url) => {
          try { const asset = await fetch(url, { cache: "reload" }); if (asset.ok) await cache.put(url, asset); } catch {}
        }));
      }
    } catch {}
    await Promise.all(APP_SHELL.filter((url) => url !== "/").map(async (url) => {
      try { const response = await fetch(url, { cache: "reload" }); if (response.ok) await cache.put(url, response); } catch {}
    }));
    await self.skipWaiting();
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
        const assets = [...html.matchAll(/(?:src|href)=["']([^"']*\/_next\/static\/[^"']+)["']/g)].map((match) => new URL(match[1], self.location.origin).pathname);
        await Promise.all([...new Set(assets)].map(async (assetUrl) => {
          try { const asset = await fetch(assetUrl, { cache: "no-store" }); if (asset.ok) await cache.put(assetUrl, asset); } catch {}
        }));
        await cache.put("/", response);
      };
      if (cached) { event.waitUntil(refreshAppShell().catch(() => {})); return cached; }
      try { const response = await fetch(request); if (response.ok) await cache.put("/", response.clone()); return response; }
      catch { return Response.error(); }
    })());
    return;
  }
  const isAppAsset = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/") || url.pathname.startsWith("/fonts/") ||
    /\.(?:png|jpe?g|svg|webp|ico|woff2?|ttf|otf)$/i.test(url.pathname) || url.pathname === "/manifest.webmanifest";
  if (isAppAsset) event.respondWith(caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)); }
      return response;
    });
  }));
});
