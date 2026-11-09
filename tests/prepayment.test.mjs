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


test("compares lump-sum, monthly and combined repayment plans", async () => {
  const { calculatePlanOptions } = await import("../lib/prepayment.ts");
  const result = calculatePlanOptions({ balance: 1200000, monthlyPayment: 30000, annualRate: 12, lumpSum: 100000, monthlyExtra: 5000 });
  assert.ok(result.lumpShorten.interest < result.baseline.interest);
  assert.ok(result.lumpReduce.interest < result.baseline.interest);
  assert.ok(result.recurringShorten.interest < result.baseline.interest);
  assert.ok(result.combined.interest < result.baseline.interest);
  assert.ok(result.combined.months <= result.lumpShorten.months);
});

test("uses the entered current balance even when original loan data is also present", () => {
  // Current balance is the source of truth after previous early repayments.
  const result = calculatePrepayment({ balance: 859074.34, monthlyPayment: 16596.52, annualRate: 6, extraPayment: 100000 });
  assert.ok(result.shorten.interest < result.baseline.interest);
});


test("does not recommend a strategy when no additional payments are entered", async () => {
  const { calculatePlanOptions } = await import("../lib/prepayment.ts");
  const result = calculatePlanOptions({ balance: 1200000, monthlyPayment: 30000, annualRate: 12, lumpSum: 0, monthlyExtra: 0 });
  assert.equal(result.recommendation, null);
});

test("does not overstate the final payment when the regular payment closes the loan", async () => {
  const { calculatePlanOptions } = await import("../lib/prepayment.ts");
  const result = calculatePlanOptions({
    balance: 1000,
    monthlyPayment: 1010,
    annualRate: 12,
    lumpSum: 500,
    monthlyExtra: 0,
  });
  assert.equal(result.baseline.months, 1);
  assert.equal(result.lumpShorten.months, 1);
  assert.equal(result.lumpShorten.totalPaid, 1010);
  assert.equal(result.lumpShorten.finalPayment, 1010);
  assert.equal(result.lumpShorten.interest, 10);
});
