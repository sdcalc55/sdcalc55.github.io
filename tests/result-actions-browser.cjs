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
    const actions = page.getByTestId('calculator-result-actions');
    const checkActions = async () => {
      await actions.waitFor({ state: 'visible' });
      assert.equal(await page.getByTestId('calculator-copy').innerText(), 'Копировать');
      assert.equal(await page.getByTestId('calculator-save').innerText(), 'Сохранить');
      await page.getByTestId('calculator-copy').click();
      await page.getByText('Скопировано в буфер обмена', { exact: true }).waitFor();
      await page.getByTestId('calculator-save').click();
      await page.getByText('Расчёт сохранён в истории', { exact: true }).waitFor();
      assert.equal(await page.getByTestId('calculator-save').innerText(), 'Сохранено');
      await page.getByTestId('calculator-save').click();
      await page.getByText('Расчёт удалён из истории', { exact: true }).waitFor();
      assert.equal(await page.getByTestId('calculator-save').innerText(), 'Сохранить');
    };

    await click('Расчёт комиссии при продаже');
    await page.locator('#price').fill('3000000');
    await page.getByTestId('total').waitFor();
    await checkActions();

    await click('На главный экран');
    await click('Расчёт по первоначальному взносу');
    await page.locator('#mortgage-part-0').fill('6000000');
    await page.getByTestId('mortgage-result-part').waitFor();
    await checkActions();

    await click('На главный экран');
    await click('Кредитный калькулятор');
    await page.locator('#loan-principal').fill('3000000');
    await page.locator('#loan-term').fill('15');
    await page.locator('#loan-rate').fill('18');
    await click('РАССЧИТАТЬ');
    await page.getByTestId('loan-monthly').waitFor();
    await checkActions();

    assert.deepEqual(errors, [], 'No uncaught browser errors');
    console.log('PASS: copy, save, unsave notifications and shared action controls in commission, down-payment and loan calculators.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
