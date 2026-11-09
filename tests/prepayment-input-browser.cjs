const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:3000');
    await page.getByRole('button', { name: 'Досрочное погашение', exact: true }).click();

    const field = label => page.getByLabel(label, { exact: true });
    const balance = field('Остаток основного долга');
    const rate = field('Процентная ставка');
    const payment = field('Текущий ежемесячный платёж');
    const monthlyExtra = field('Ежемесячный досрочный платёж');
    const lump = field('Разовый досрочный платёж');

    await balance.fill('1234567');
    assert.equal(await balance.inputValue(), '1 234 567');

    // Backspace and Delete must edit digits rather than getting stuck on grouping spaces.
    await balance.press('End');
    await balance.press('Backspace');
    assert.equal(await balance.inputValue(), '123 456');
    await balance.evaluate(input => input.setSelectionRange(0, 1));
    await balance.press('Delete');
    assert.equal(await balance.inputValue(), '23 456');

    // Replacing a selection must preserve the new value and not corrupt formatting.
    await balance.fill('1234567');
    await balance.evaluate(input => input.setSelectionRange(0, input.value.length));
    await balance.pressSequentially('7654321');
    assert.equal(await balance.inputValue(), '7 654 321');

    // Invalid pasted content must be rejected as a whole, not stripped into a valid amount.
    await page.evaluate(() => navigator.clipboard.writeText('-450000'));
    await balance.focus();
    await balance.press('Control+A');
    await balance.press('Control+V');
    assert.equal(await balance.inputValue(), '7 654 321');

    await page.evaluate(() => navigator.clipboard.writeText('1 23'));
    await balance.focus();
    await balance.press('Control+A');
    await balance.press('Control+V');
    assert.equal(await balance.inputValue(), '7 654 321');

    await page.evaluate(() => navigator.clipboard.writeText('1 234 567'));
    await balance.focus();
    await balance.press('Control+A');
    await balance.press('Control+V');
    assert.equal(await balance.inputValue(), '1 234 567');

    // Explicit clear control works and leaves the field editable.
    await page.getByRole('button', { name: 'Очистить поле: Остаток основного долга' }).click();
    assert.equal(await balance.inputValue(), '');
    await balance.fill('4500000');

    // Invalid rate and non-amortizing payment are rejected; restoring valid data restores results.
    await rate.fill('31');
    assert.equal(await rate.inputValue(), '6');
    await payment.fill('100');
    await page.getByText(/Платёж должен быть больше ежемесячно начисляемых процентов/).waitFor();
    await payment.fill('42000');
    await monthlyExtra.fill('5000');
    await page.getByText('Сокращение срока', { exact: true }).waitFor();
    const before = await page.locator('body').innerText();
    await monthlyExtra.fill('6000');
    const after = await page.locator('body').innerText();
    assert.notEqual(after, before, 'results must recalculate after each accepted input change');

    // The fixed-payment scenario must clearly retain the mandatory installment
    // and show the extra amount separately.
    await page.getByText('Текущий платёж 42 000 ₽ сохраняется.', { exact: true }).waitFor();
    await page.getByText('Досрочные взносы вносятся сверх него.', { exact: true }).waitFor();

    // Lump sum boundary: greater than outstanding balance is rejected.
    await lump.fill('4500001');
    assert.equal(await lump.inputValue(), '4 500 001');
    await page.getByText('Разовый взнос не может превышать остаток долга.', { exact: true }).waitFor();

    assert.deepEqual(errors, [], 'No uncaught browser errors');
    console.log('PASS: prepayment input typing, paste, clear, selection, cursor, validation and live result recalculation.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
