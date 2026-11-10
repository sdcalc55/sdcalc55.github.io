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
    const rate = field('Процентная ставка').last();
    const payment = field('Текущий ежемесячный платёж');
    const monthlyExtra = field('Ежемесячный досрочный платёж');
    const lump = field('Разовый досрочный платёж');

    // The preliminary-calculation disclaimer and details must stay hidden
    // until the user has entered an early repayment and results are shown.
    await page.getByTestId('prepayment-disclaimer').waitFor({ state: 'detached' });
    await page.getByText('Подробности расчёта', { exact: true }).waitFor({ state: 'detached' });

    await balance.fill('1234567');
    assert.equal(await balance.inputValue(), '1 234 567');

    // Backspace directly after a thousands separator removes the preceding digit.
    await balance.evaluate(input => input.setSelectionRange(2, 2));
    await balance.press('Backspace');
    assert.equal(await balance.inputValue(), '234 567');
    await balance.fill('1234567');

    // Backspace and Delete must edit digits rather than getting stuck on grouping spaces.
    await balance.press('End');
    await balance.press('Backspace');
    assert.equal(await balance.inputValue(), '123 456');
    await balance.evaluate(input => input.setSelectionRange(0, 1));
    await balance.press('Delete');
    assert.equal(await balance.inputValue(), '23 456');

    // Delete adjacent to a thousands separator removes the next digit and keeps the caret usable.
    await balance.fill('1234567');
    await balance.evaluate(input => input.setSelectionRange(1, 1));
    await balance.press('Delete');
    assert.equal(await balance.inputValue(), '134 567');
    await balance.evaluate(input => input.setSelectionRange(1, 1));
    await balance.press('Delete');
    assert.equal(await balance.inputValue(), '145 67'.replace('145 67', '14 567'));

    // Deleting a selected range spanning grouping spaces removes only selected digits.
    await balance.fill('1234567');
    await balance.evaluate(input => input.setSelectionRange(1, 5));
    await balance.press('Backspace');
    assert.equal(await balance.inputValue(), '1 567');

    // Backspace with a selected range removes exactly the selection.
    await balance.fill('1234567');
    await balance.evaluate(input => input.setSelectionRange(2, 4));
    await balance.press('Backspace');
    assert.equal(await balance.inputValue(), '1 567');

    // Replacing a selection must preserve the new value and not corrupt formatting.
    await balance.fill('1234567');
    await balance.evaluate(input => input.setSelectionRange(0, input.value.length));
    await balance.pressSequentially('7654321');
    assert.equal(await balance.inputValue(), '7 654 321');

    // Cursor remains at the logical digit position when grouping separators move.
    await balance.fill('1234567');
    await balance.evaluate(input => input.setSelectionRange(1, 1));
    await balance.pressSequentially('9');
    assert.equal(await balance.inputValue(), '19 234 567');
    assert.equal(await balance.evaluate(input => input.selectionStart), 2);

    // Reset the field after the cursor-position case before checking paste rejection.
    await balance.fill('7654321');

    // Invalid pasted content must be rejected as a whole, not stripped into a valid amount.
    for (const invalid of ['-450000', 'NaN', 'Infinity', '1e6', '1,2.3', '12%']) {
      await page.evaluate(value => navigator.clipboard.writeText(value), invalid);
      await balance.focus();
      await balance.press('Control+A');
      await balance.press('Control+V');
      assert.equal(await balance.inputValue(), '7 654 321', 'invalid clipboard value rejected: ' + invalid);
    }

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
    const disclaimer = page.getByTestId('prepayment-disclaimer');
    await disclaimer.waitFor({ state: 'visible' });
    await page.getByText('Подробности расчёта', { exact: true }).waitFor({ state: 'visible' });
    const disclaimerPrecedesDetails = await disclaimer.evaluate(element => Boolean(
      element.compareDocumentPosition(
        [...document.querySelectorAll('summary')].find(item => item.innerText.includes('Подробности расчёта'))
      ) & 4
    ));
    assert.ok(disclaimerPrecedesDetails, 'disclaimer must appear before calculation details');
    const before = await page.locator('body').innerText();
    await monthlyExtra.fill('6000');
    const after = await page.locator('body').innerText();
    assert.notEqual(after, before, 'results must recalculate after each accepted input change');

    // The fixed-payment scenario must clearly retain the mandatory installment
    // and show the extra amount separately.
    await page.getByText('Текущий платёж 42 000 ₽ сохраняется.', { exact: true }).waitFor();
    await page.getByText('Досрочные взносы вносятся сверх него.', { exact: true }).waitFor();
    const termSavings = page.getByTestId('term-interest-savings');
    const remainingTerm = page.getByTestId('term-remaining-duration');
    const reducedPayment = page.getByTestId('reduced-payment-display');
    await termSavings.waitFor({ state: 'visible' });
    await remainingTerm.waitFor({ state: 'visible' });
    await reducedPayment.waitFor({ state: 'visible' });
    assert.match(await remainingTerm.innerText(), /\d+ (?:год|года|лет|мес\.)/);
    assert.equal(
      await reducedPayment.evaluate(element => getComputedStyle(element).backgroundColor),
      'rgba(0, 0, 0, 0)',
      'new required payment must not sit inside a separate colored background block'
    );

    // Lump sum boundary: greater than outstanding balance is rejected.
    await lump.fill('4500001');
    assert.equal(await lump.inputValue(), '4 500 001');
    await page.getByText('Разовый взнос не может превышать остаток долга.', { exact: true }).waitFor();

    // Monthly-only, lump-only and combined inputs each produce valid results.
    await lump.fill('0');
    await monthlyExtra.fill('4500001');
    await page.getByText('Ежемесячный досрочный платёж не может превышать остаток долга.', { exact: true }).waitFor();
    await monthlyExtra.fill('0');
    await lump.fill('5000');
    await page.getByText('Сокращение срока', { exact: true }).waitFor();
    await lump.fill('0');
    await monthlyExtra.fill('5000');
    await page.getByText('Сокращение срока', { exact: true }).waitFor();
    await lump.fill('1000');
    await page.getByText('Сокращение срока', { exact: true }).waitFor();

    assert.deepEqual(errors, [], 'No uncaught browser errors');
    console.log('PASS: prepayment input typing, paste, clear, selection, cursor, validation and live result recalculation.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
