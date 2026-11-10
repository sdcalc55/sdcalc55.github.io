const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  const failedRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));

  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => 'serviceWorker' in navigator && navigator.serviceWorker.controller, { timeout: 60000 });

  const precache = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) throw new Error('Service Worker не активирован');
    const manifestResponse = await fetch('/precache-manifest.json');
    if (!manifestResponse.ok) throw new Error('Precache manifest недоступен');
    const manifest = await manifestResponse.json();
    const cacheNames = await caches.keys();
    const cacheName = cacheNames.filter(name => name.startsWith('sd-calculator-pwa-')).sort().at(-1);
    if (!cacheName) throw new Error('Кэш приложения не создан');
    const cache = await caches.open(cacheName);
    const missing = [];
    for (const path of manifest.files) {
      if (!await cache.match(path, { ignoreSearch: true })) missing.push(path);
    }
    return { total: manifest.files.length, missing, cacheName };
  });
  assert.ok(precache.total > 0, 'Манифест предварительного кэширования пуст');
  assert.deepEqual(precache.missing, [], 'Не все ресурсы приложения сохранены для офлайн-режима');

  const onlineVisuals = await page.evaluate(() => ({
    title: document.title,
    font: getComputedStyle(document.body).fontFamily,
    background: getComputedStyle(document.body).backgroundColor,
    images: [...document.images].map(image => ({ src: image.currentSrc || image.src, loaded: image.complete && image.naturalWidth > 0 }))
  }));
  assert.match(onlineVisuals.title, /SD/);
  assert.ok(onlineVisuals.font && onlineVisuals.font !== 'serif');
  assert.ok(onlineVisuals.images.every(image => image.loaded), 'Есть незагруженные изображения в онлайн-режиме');

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Расчёт комиссии при продаже', exact: true }).click();
  await page.getByRole('heading', { name: 'Комиссия', exact: true }).waitFor();
  await page.locator('#price').fill('3000000');
  await page.getByTestId('total').waitFor();
  assert.equal((await page.getByTestId('total').innerText()).replace(/\s/g, ''), '95000₽');

  await page.getByRole('button', { name: 'На главный экран', exact: true }).click().catch(() => {});
  const offlineState = await page.evaluate(() => ({
    controlled: Boolean(navigator.serviceWorker.controller),
    title: document.title,
    bodyText: document.body.innerText,
    images: [...document.images].map(image => ({ src: image.currentSrc || image.src, loaded: image.complete && image.naturalWidth > 0 }))
  }));
  assert.ok(offlineState.controlled, 'После перезагрузки страница не управляется Service Worker');
  assert.match(offlineState.bodyText, /SD/);
  assert.ok(offlineState.images.every(image => image.loaded), 'Есть незагруженные изображения в офлайн-режиме');
  assert.deepEqual(pageErrors, [], 'В офлайн-режиме возникли ошибки JavaScript');
  assert.deepEqual(failedRequests, [], 'В офлайн-режиме есть неудачные сетевые запросы');

  console.log(JSON.stringify({
    result: 'PASS',
    precachedFiles: precache.total,
    cache: precache.cacheName,
    offlineCommissionResult: '95 000 ₽',
    offlineImagesLoaded: offlineState.images.length,
    javascriptErrors: pageErrors.length,
    failedRequests: failedRequests.length
  }, null, 2));
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
