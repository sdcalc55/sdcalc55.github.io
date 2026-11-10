import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from '../lib/calculator.ts';
import { applyDiscount, applyPairedDiscount, discounts } from '../lib/discounts.ts';

test('Скидка 3% от комиссии 125 000: скидка 3 750, к оплате 121 250', () => {
  assert.deepEqual(applyDiscount(125000,3),{total:121250,saving:3750});
});
test('Ставки из таблицы и округление до рубля', () => {
  for (const [rate,total] of [[0,125000],[3,121250],[5,118750],[7,116250],[10,112500]]) {
    assert.equal(applyDiscount(125000,rate).total,total);
  }
  assert.deepEqual(applyDiscount(37502,3),{total:36377,saving:1125});
});
test('Скидка применяется после тарифного минимума', () => {
  const base = calculate('purchase','country',2000000);
  assert.equal(base.status,'ok');
  assert.equal(base.total,60000);
  assert.equal(applyDiscount(base.total,3).total,58200);
});
test('Встречная сделка: обе скидки уменьшают текущую комиссию', () => {
  const sale = calculate('sale','apartment',9000000);
  const purchase = calculate('purchase','apartment',5000000);
  assert.equal(sale.status,'ok'); assert.equal(purchase.status,'ok');
  assert.equal(sale.total,185000); assert.equal(purchase.total,74000);
  assert.deepEqual(applyPairedDiscount(sale.total,purchase.total),{
    total:177230, saving:7770, currentSaving:5550, previousSaving:2220, capped: false,
  });
  assert.deepEqual(applyPairedDiscount(purchase.total,sale.total),{
    total:66230, saving:7770, currentSaving:2220, previousSaving:5550, capped: false,
  });
});
test('Родство указано в примечаниях только пяти разрешённых скидок', () => {
  assert.equal(discounts.length,10);
  assert.equal(new Set(discounts.map(d=>d.id)).size,10);
  assert(discounts.every(d=>d.note && !('kinship' in d)));
  const excluded = ['veteran','svo','pensioner','disability','large-family'];
  const text = 'Степень родства при предоставлении скидки: мать, отец, сын, дочь, муж, жена, родители мужа/жены.';
  for (const discount of discounts) assert.equal(discount.note.includes(text), !excluded.includes(discount.id));
  assert.deepEqual(discounts.find(d=>d.id==='certificate').operations,['purchase']);
  assert.deepEqual(discounts.find(d=>d.id==='new-build').operations,['sale']);
});


test('Встречная скидка не превышает текущую комиссию при большой предыдущей комиссии', () => {
  // Независимый ожидаемый результат: 3% от 1 000 = 30 ₽,
  // 3% от 10 000 000 = 300 000 ₽; доступная скидка ограничена 1 000 ₽.
  assert.deepEqual(applyPairedDiscount(1000, 10000000), {
    total: 0,
    saving: 1000,
    currentSaving: 30,
    previousSaving: 300000,
    capped: true,
  });
});

test('Встречная скидка не ограничивается, если сумма скидок меньше текущей комиссии', () => {
  assert.deepEqual(applyPairedDiscount(100000, 50000), {
    total: 95500,
    saving: 4500,
    currentSaving: 3000,
    previousSaving: 1500,
    capped: false,
  });
});
