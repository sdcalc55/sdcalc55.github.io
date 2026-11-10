const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:3000');
    await page.evaluate(() => localStorage.clear());

    const click = name => page.getByRole('button', { name, exact: true }).click();
    const checkActions = async container => {
      const actions = container.getByTestId('calculator-result-actions');
      const copy = container.getByTestId('calculator-copy');
      const save = container.getByTestId('calculator-save');
      await actions.waitFor({ state: 'visible' });
      await page.waitForFunction(() => {
        const node = document.querySelector('[data-testid="calculator-result-actions"] [data-testid="calculator-copy"]');
        return !!node && node.isConnected && !node.hasAttribute("disabled");
      });
      await page.waitForTimeout(250);
      assert.equal(await copy.innerText(), 'Копировать');
      assert.equal(await save.innerText(), 'Сохранить');
      await copy.click({ timeout: 10000 });
      await page.getByText('Скопировано', { exact: true }).waitFor();
      await save.click();
      assert.equal(await save.getAttribute('aria-pressed'), 'true');
      assert.equal(await save.innerText(), 'Убрать сохранение');
      await save.click();
      assert.equal(await save.getAttribute('aria-pressed'), 'false');
      assert.equal(await save.innerText(), 'Сохранить');
    };

    await click('Расчёт комиссии при продаже');
    await page.locator('#price').fill('3000000');
    await page.getByTestId('total').waitFor();
    await checkActions(page.getByRole('region', { name: 'Комиссия' }));

    await click('На главный экран');
    await click('Расчёт по первоначальному взносу');
    await page.locator('#mortgage-part-0').fill('6000000');
    await page.getByTestId('mortgage-result-part').waitFor();
    await checkActions(page.getByRole('region', { name: 'Рассчитать первоначальный взнос' }));

    await click('На главный экран');
    await click('Кредитный калькулятор');
    await page.locator('#loan-principal').fill('3000000');
    await page.locator('#loan-term').fill('15');
    await page.locator('#loan-rate').fill('18');
    await click('РАССЧИТАТЬ');
    await page.getByTestId('loan-monthly').waitFor();
    await checkActions(page.getByRole('region', { name: 'Результаты кредита' }));

    assert.deepEqual(errors, [], 'No uncaught browser errors');
    console.log('PASS: copy feedback, save state and shared action controls in commission, down-payment and loan calculators.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
