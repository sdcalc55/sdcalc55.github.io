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


import { inferRemainingTerm, simulateFixedPayment, simulateReducedPayment } from "../lib/prepayment-simulation.ts";

test("reduced-payment baseline exactly preserves the entered payment without prepayment", () => {
  const balance = 4500000, payment = 42000, annualRate = 6;
  const term = inferRemainingTerm(balance, annualRate, payment);
  const baseline = simulateFixedPayment(balance, annualRate, payment, 0, 0, term);
  const reduced = simulateReducedPayment(balance, annualRate, term, payment, 0, 0);
  assert.equal(reduced.completed, true);
  assert.equal(reduced.months, baseline.months);
  assert.ok(Math.abs(reduced.firstPayment - payment) < 0.0001);
  assert.ok(Math.abs(reduced.interest - baseline.interest) < 0.01);
});

test("small one-off prepayments reduce the required payment only in proportion to the amount", () => {
  const balance = 4500000, payment = 42000, annualRate = 6;
  const term = inferRemainingTerm(balance, annualRate, payment);
  const base = simulateFixedPayment(balance, annualRate, payment, 0, 0, term);
  const amounts = [1, 6, 100, 1000, 5000];
  let previousPayment = payment;
  let previousSavings = 0;
  for (const lump of amounts) {
    const result = simulateReducedPayment(balance, annualRate, term, payment, 0, lump);
    const savings = base.interest - result.interest;
    assert.equal(result.completed, true);
    assert.ok(result.firstPayment < previousPayment, `payment should decrease for lump=${lump}`);
    assert.ok(result.firstPayment <= payment);
    assert.ok(savings >= previousSavings - 0.01, `savings should be monotonic for lump=${lump}`);
    assert.ok(savings >= 0);
    previousPayment = result.firstPayment;
    previousSavings = savings;
  }
  const sixRuble = simulateReducedPayment(balance, annualRate, term, payment, 0, 6);
  assert.ok(Math.abs(sixRuble.firstPayment - 41999.9437563) < 0.01);
});

test("zero prepayment never creates artificial payment reduction or interest savings", () => {
  for (const annualRate of [0, 6, 12, 17.45, 30]) {
    const balance = 1200000, payment = 30000;
    if (payment <= balance * annualRate / 1200) continue;
    const term = inferRemainingTerm(balance, annualRate, payment);
    const base = simulateFixedPayment(balance, annualRate, payment, 0, 0, term);
    const reduced = simulateReducedPayment(balance, annualRate, term, payment, 0, 0);
    assert.ok(Math.abs(reduced.firstPayment - payment) < 0.001);
    assert.ok(Math.abs(reduced.interest - base.interest) < 0.01);
  }
});

test("recurring and combined extra payments do not increase interest versus baseline", () => {
  const cases = [
    { balance: 1200000, payment: 30000, rate: 12, monthly: 5000, lump: 0 },
    { balance: 4500000, payment: 42000, rate: 6, monthly: 5000, lump: 100000 },
    { balance: 859074.34, payment: 16596.52, rate: 6, monthly: 2500, lump: 100000 },
  ];
  for (const item of cases) {
    const term = inferRemainingTerm(item.balance, item.rate, item.payment);
    const base = simulateFixedPayment(item.balance, item.rate, item.payment, 0, 0, term);
    const recurring = simulateReducedPayment(item.balance, item.rate, term, item.payment, item.monthly, 0);
    const combined = simulateReducedPayment(item.balance, item.rate, term, item.payment, item.monthly, item.lump);
    assert.equal(recurring.completed, true);
    assert.equal(combined.completed, true);
    assert.ok(recurring.interest <= base.interest + 0.01);
    assert.ok(combined.interest <= base.interest + 0.01);
  }
});
