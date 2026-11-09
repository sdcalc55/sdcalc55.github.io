import test from "node:test";
import assert from "node:assert/strict";
import { calculatePrepayment, estimateRemainingBalance, findPrepaymentAmount } from "../lib/prepayment.ts";

test("compares both early repayment strategies against the original schedule", () => {
  const input = { balance: 2560000, monthlyPayment: 50000, annualRate: 17.45, extraPayment: 75000 };
  const result = calculatePrepayment(input);
  assert.ok(result.shorten.months < result.baseline.months);
  assert.equal(result.reduce.months, result.baseline.months);
  assert.ok(result.reduce.monthlyPayment < input.monthlyPayment);
  assert.ok(result.shorten.interest < result.baseline.interest);
  assert.ok(result.reduce.interest < result.baseline.interest);
  assert.ok(result.shorten.interest < result.reduce.interest);
  assert.equal(result.appliedExtra, 75000);
});

test("estimates a remaining balance from original loan terms", () => {
  const result = estimateRemainingBalance(3000000, 10, 40000, "2024-01", new Date(2024, 3, 1));
  assert.equal(result.monthsPaid, 3);
  assert.ok(result.balance > 0 && result.balance < 3000000);
});

test("finds an early payment amount that reaches the requested monthly payment", () => {
  const input = { balance: 2560000, monthlyPayment: 50000, annualRate: 17.45 };
  const amount = findPrepaymentAmount(input, "payment", 40000);
  assert.ok(amount > 0);
  const result = calculatePrepayment({ ...input, extraPayment: amount });
  assert.ok(result.reduce.monthlyPayment <= 40000);
});

test("rejects a payment that does not cover monthly interest", () => {
  assert.throws(() => calculatePrepayment({ balance: 1000000, monthlyPayment: 1000, annualRate: 20, extraPayment: 10000 }), /не покрывает проценты/);
});
