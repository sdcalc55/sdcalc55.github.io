import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeDecimalInput, sanitizeIntegerInput } from '../lib/input-sanitize.ts';

test('Ввод комфортного платежа принимает цифры', () => {
  for (const digit of '0123456789') assert.equal(sanitizeDecimalInput(digit), digit);
  assert.equal(sanitizeDecimalInput('40000'), '40000');
  assert.equal(sanitizeDecimalInput('1250000'), '1250000');
  assert.equal(sanitizeDecimalInput('40 000'), '40000');
});

test('Денежный ввод сохраняет десятичную часть с точкой и запятой', () => {
  assert.equal(sanitizeDecimalInput('40000,50'), '40000,50');
  assert.equal(sanitizeDecimalInput('40000.50'), '40000.50');
  assert.equal(sanitizeDecimalInput('1 234 567,89 ₽'), '1234567,89');
});

test('Денежный ввод отбрасывает недопустимые символы и лишние разделители', () => {
  assert.equal(sanitizeDecimalInput('abc40000'), '40000');
  assert.equal(sanitizeDecimalInput('40-000'), '40000');
  assert.equal(sanitizeDecimalInput('1,2,3'), '1,23');
  assert.equal(sanitizeDecimalInput('1.2.3'), '1.23');
  assert.equal(sanitizeDecimalInput(''), '');
});

test('Ввод срока принимает только цифры и ограничивает длину', () => {
  assert.equal(sanitizeIntegerInput('180', 3), '180');
  assert.equal(sanitizeIntegerInput('1a8-0', 3), '180');
  assert.equal(sanitizeIntegerInput('12345', 3), '123');
});
