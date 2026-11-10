import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, parseMoney, formatInput } from '../lib/calculator.ts';

const examples = [
  ['sale','apartment',900000,60000], ['sale','apartment',1000000,65000],
  ['sale','country',400000,55000], ['sale','country',700000,70000], ['sale','country',2000000,85000],
  ['sale','garage',400000,30000], ['sale','garage',499500,30000], ['sale','garage',500000,37500],
  ['sale','commercial',3000000,134000],
  ['purchase','apartment',900000,34000], ['purchase','apartment',1000000,34000],
  ['purchase','country',400000,40000], ['purchase','country',700000,50000], ['purchase','country',2000000,60000],
  ['purchase','commercial',5000000,75000], ['purchase','commercial',1000000,15000],
  ['purchase','commercial',100,2], ['purchase','commercial',0.01,0],
  ['purchase','garage',400000,27000], ['purchase','garage',500000,32000], ['purchase','land',1000000,85000,5000000],
];
const verify = (op, category, price, expected, credit) => {
  const result = calculate(op,category,price,credit);
  if (expected === 'undefined') assert.equal(result.status,'undefined');
  else { assert.equal(result.status,'ok'); assert.equal(result.total, expected); }
};
examples.forEach(([op,category,price,expected,credit],i) => test(`Пример ${i+1}: ${op}/${category}/${price}`, () => verify(op,category,price,expected,credit)));
const boundaries = [
  ['sale','garage',499000,30000], ['sale','garage',499000.01,30000], ['sale','garage',499001,30000], ['sale','garage',499999,30000], ['sale','garage',499999.01,'undefined'], ['sale','garage',499999.99,'undefined'], ['sale','garage',500000,37500],
  ['sale','country',499999,55000], ['sale','country',499999.5,'undefined'], ['sale','country',500000,70000], ['sale','country',999999,70000], ['sale','country',999999.5,'undefined'], ['sale','country',1000000,70000],
  ['purchase','country',499999,40000], ['purchase','country',499999.5,'undefined'], ['purchase','country',500000,50000], ['purchase','country',999999,50000], ['purchase','country',999999.5,'undefined'], ['purchase','country',1000000,60000],
  ['purchase','country',2500000,60000], ['purchase','country',3000000,65000],
  ['purchase','garage',499999,27000], ['purchase','garage',499999.5,'undefined'], ['purchase','garage',500000,32000],
  ['sale','apartment',999999.99,60000], ['purchase','apartment',999999.99,34000],
  ['sale','commercial',0.01,59000], ['sale','commercial',1000020,84001], ['sale','garage',500100,37502],
  ['purchase','garage',500049.99,32000], ['purchase','garage',500050,32001],
];
boundaries.forEach(([op,category,price,expected],i) => test(`Граница ${i+1}: ${op}/${category}/${price}`, () => verify(op,category,price,expected)));
for (const value of [null, 0, -1, -500000, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER+1]) {
  test(`Некорректная цена: ${value}`, () => {
    for (const [op,cats] of [['sale',['apartment','country','garage','commercial']],['purchase',['apartment','country','garage','land','commercial']]]) {
      for (const category of cats) assert.equal(calculate(op,category,value,5000000).status,'invalid');
    }
  });
  test(`Некорректный кредит: ${value}`, () => assert.equal(calculate('purchase','land',1000000,value).status,'invalid'));
}
test('Участок: оба значения входят в базу', () => {
  const r = calculate('purchase','land',1000000,5000000);
  assert.equal(r.base,6000000); assert.equal(r.percent,60000); assert.equal(r.fixed,25000); assert.equal(r.total,85000);
  assert.equal(calculate('purchase','land',2000000,5000000).total,95000);
  assert.equal(calculate('purchase','land',1000000,6000000).total,95000);
});
test('Покупка коммерческой недвижимости: только 1,5%, без минимума и доплат', () => {
  const r = calculate('purchase','commercial',5000000);
  assert.equal(r.fixed,0); assert.equal(r.rate,0.015); assert.equal(r.base,5000000);
  assert.equal(r.percent,75000); assert.equal(r.calculated,75000);
  assert.equal(r.total,75000); assert.equal(r.minimumApplied,false);
  assert.equal(calculate('purchase','commercial',1000000,5000000).total,15000);
});
test('Минимум применяется только когда определяет итог', () => {
  const below = calculate('purchase','country',2000000);
  assert.equal(below.calculated,55000); assert.equal(below.total,60000); assert.equal(below.minimumApplied,true);
  for (const price of [2500000,3000000]) assert.equal(calculate('purchase','country',price).minimumApplied,false);
});
test('Фиксированный тариф без процентной части', () => {
  const r=calculate('sale','apartment',900000); assert.equal(r.rate,0); assert.equal(r.percent,0); assert.equal(r.fixed,60000);
});
test('Недопустимые сочетания операции и категории', () => {
  assert.equal(calculate('sale','land',1000000,5000000).status,'invalid');
  assert.equal(calculate('purchase','unknown',1000000).status,'invalid');
});
for (const input of ['', ' ', '0','0,00','-1','-100 000','−500000','100-000','abc','1e6','NaN','Infinity','1,2,3','1.2.3','12₽','.','1,']) {
  test(`Ввод отклонён: ${JSON.stringify(input)}`, () => assert.equal(parseMoney(input),null));
}
for (const [input,expected] of [['1 000 000',1000000],['1\u00a0000\u202f000,50',1000000.5],['1234.56',1234.56],['0,01',0.01]]) {
  test(`Десятичный ввод: ${input}`, () => assert.equal(parseMoney(input),expected));
}
test('Удаление первой цифры сохраняет нули для ввода замены', () => {
  assert.equal(formatInput('000000'), '000 000');
  assert.equal(formatInput('5000000'), '5 000 000');
  assert.equal(formatInput('000123'), '123');
  assert.equal(parseMoney(formatInput('000000')), null);
});
test('Форматирование сохраняет дробную часть и отрицательный знак', () => {
  assert.equal(formatInput('1234567,50'),'1 234 567,50'); assert.equal(formatInput('1234567.50'),'1 234 567.50');
  assert.equal(formatInput('-12345'),'-12345'); assert.equal(parseMoney(formatInput('-12345')),null);
  assert.equal(formatInput('1234,'),'1 234,'); assert.equal(formatInput(''),'');
});
