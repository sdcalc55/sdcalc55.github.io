import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLoan, calculateLoanFromPayment } from '../lib/loan.ts';

test('Аннуитет: 3 млн, 15 лет, 18% и согласованность итогов', () => {
  const result = calculateLoan(3000000, 180, 18);
  assert.equal(result.monthlyPayment.toFixed(2), '48312.63');
  assert.equal(result.totalPayment, Math.round(result.monthlyPayment * 180 * 100) / 100);
  assert.equal(result.interest, Math.round((result.totalPayment - result.principal) * 100) / 100);
});
test('Нулевая ставка, в том числе неделимая на месяцы сумма', () => {
  for (const [sum, months] of [[3000000,180],[100,3]]) {
    const result = calculateLoan(sum, months, 0);
    assert.equal(result.monthlyPayment, sum / months);
    assert.equal(result.totalPayment, sum);
    assert.equal(result.interest, 0);
  }
});
test('Малая ставка сохраняет численную точность', () => {
  const result = calculateLoan(1000000, 12, 0.000001);
  assert(Number.isFinite(result.monthlyPayment));
  assert(Math.abs(result.monthlyPayment - 1000000 / 12) < 0.01);
});
test('Срок кредита ограничен 30 годами или 360 месяцами', () => {
  assert.equal(calculateLoan(3000000, 360, 18).months, 360);
  for (const months of [361, 31 * 12, 30.1 * 12]) {
    assert.throws(() => calculateLoan(3000000, months, 18), { message: 'Срок кредита должен составлять не более 30 лет' });
  }
});

test('Сумма кредита учитывает копейки и отклоняет доли копейки', () => {
  for (const sum of [0.01, 0.29, 1000.10, 3000000.99]) {
    const result = calculateLoan(sum, 12, 0);
    assert.equal(result.principal, sum);
    assert.equal(result.totalPayment, sum);
    assert(Number.isFinite(result.principal / result.totalPayment));
  }
  assert.throws(() => calculateLoan(0.001, 12, 0), { message: 'Сумма кредита должна быть не меньше 0,01 ₽.' });
  for (const sum of [0.015, 1000.999]) {
    assert.throws(() => calculateLoan(sum, 12, 18), { message: 'Укажите сумму кредита с точностью до копеек.' });
  }
});

test('Некорректные значения не дают результата', () => {
  for (const values of [[0,180,18],[-1,180,18],[3000000,0,18],[3000000,1.5,18],[3000000,180,-1],[NaN,180,18],[3000000,180,Infinity]]) {
    assert.throws(() => calculateLoan(...values));
  }
});

test('Обратный расчёт допускает вычисленную сумму кредита выше лимита вводимой суммы', () => {
  const result = calculateLoanFromPayment(255555555, 264, 12);
  assert(result.principal > 999999999);
  assert(result.principal < 255555555 * 264);
  assert(result.monthlyPayment <= 255555555);
  assert.equal(result.principal * 100, Math.round(result.principal * 100));
});

test('Лимит 999 999 999 ₽ применяется к введённой сумме, но не к результату', () => {
  assert.throws(() => calculateLoan(1000000000, 240, 12), { message: 'Введите корректную сумму. Максимум — 999 999 999 ₽.' });
  assert.throws(() => calculateLoanFromPayment(1000000000, 240, 12), { message: 'Введите корректную сумму. Максимум — 999 999 999 ₽.' });
});
