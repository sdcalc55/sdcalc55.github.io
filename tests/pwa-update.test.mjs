import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const registration = await readFile(new URL("../components/pwa-register.tsx", import.meta.url), "utf8");

test("PWA update downloads the complete build into a separate versioned cache", () => {
  assert.match(worker, /const CACHE_NAME = "sd-calculator-pwa-__BUILD_VERSION__"/);
  assert.match(worker, /Array\.isArray\(manifest\.files\)/);
  assert.match(worker, /await precacheFiles\(cache, manifest\.files\)/);
  assert.match(worker, /await self\.skipWaiting\(\)/);
  assert.match(worker, /await caches\.delete\(CACHE_NAME\)/);
});

test("PWA keeps cache-first launch and does not wait for network", () => {
  assert.match(worker, /const cachedPage = await cache\.match\(request\)/);
  assert.match(worker, /event\.waitUntil\(refreshPage\.catch\(\(\) => undefined\)\)/);
});

test("PWA update does not reload on first installation or during a calculation", () => {
  assert.match(registration, /const hadController = Boolean\(navigator\.serviceWorker\.controller\)/);
  assert.match(registration, /if \(!screen \|\| !\["home", "history", "settings"\]\.includes\(screen\)\) return false/);
  assert.match(registration, /if \(!hadController \|\| refreshing \|\| !isSafeToReload\(\)\) return/);
});
