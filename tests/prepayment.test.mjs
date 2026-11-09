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

test("active calculator uses the detailed simulation for all repayment scenarios", async () => {
  const { calculatePlanOptions, calculatePrepayment } = await import("../lib/prepayment.ts");
  const input = { balance: 100000, monthlyPayment: 10000, annualRate: 12 };
  const oneOff = calculatePrepayment({ ...input, extraPayment: 20000 });
  const plans = calculatePlanOptions({ ...input, lumpSum: 5000, monthlyExtra: 1000 });

  assert.ok(oneOff.shorten.months < oneOff.baseline.months);
  assert.equal(oneOff.reduce.months, oneOff.baseline.months);
  assert.ok(oneOff.reduce.monthlyPayment < input.monthlyPayment);
  assert.ok(plans.recurringShorten.months < plans.baseline.months);
  assert.ok(plans.combined.months <= plans.lumpShorten.months);
  assert.ok(plans.combined.interest < plans.lumpShorten.interest);
  assert.ok(Math.abs(plans.combined.totalPaid - (input.balance + plans.combined.interest)) < 0.02);
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


test("simulation rejects monthly extra payments larger than the outstanding debt", () => {
  const balance = 4500000, payment = 42000, annualRate = 6;
  const term = inferRemainingTerm(balance, annualRate, payment);
  assert.throws(
    () => simulateFixedPayment(balance, annualRate, payment, 666665555, 0, term),
    /не может превышать остаток долга/,
  );
  assert.throws(
    () => simulateReducedPayment(balance, annualRate, term, payment, 666665555, 0),
    /не может превышать остаток долга/,
  );
});

test("simulation rejects a lump sum larger than the outstanding debt", () => {
  const balance = 4500000, payment = 42000, annualRate = 6;
  const term = inferRemainingTerm(balance, annualRate, payment);
  assert.throws(
    () => simulateReducedPayment(balance, annualRate, term, payment, 0, 666665555),
    /не может превышать остаток долга/,
  );
});


test("rejects non-finite and out-of-range loan inputs before simulation", () => {
  assert.throws(() => inferRemainingTerm(Infinity, 6, 42000), /остаток основного долга/);
  assert.throws(() => inferRemainingTerm(4500000, 31, 42000), /от 0 до 30/);
  assert.throws(() => inferRemainingTerm(4500000, 6, NaN), /больше нуля/);
  assert.throws(() => inferRemainingTerm(4500000, 6, 22500), /больше начисляемых процентов/);
});

test("rejects a repayment term longer than the supported 50-year horizon", () => {
  assert.throws(
    () => inferRemainingTerm(4500000, 6, 22501),
    /превышает 50 лет/,
  );
  assert.throws(
    () => inferRemainingTerm(999999999, 0, 1000000),
    /превышает 50 лет/,
  );
});

test("accepts valid boundary values including zero interest and a one-period payoff", () => {
  assert.equal(inferRemainingTerm(100000, 0, 100000), 1);
  assert.ok(inferRemainingTerm(4500000, 30, 200000) > 0);
  const term = inferRemainingTerm(100000, 12, 9000);
  const result = simulateReducedPayment(100000, 12, term, 9000, 0, 0);
  assert.equal(result.completed, true);
  assert.ok(result.firstPayment > 0);
});


// Golden values below were calculated independently from the recurrence:
// interest = opening balance * annual rate / 1200; then scheduled payment;
// then the extra payment. Values are not derived from production helpers.
test("matches independent golden values for a standard monthly schedule", () => {
  const result = calculatePrepayment({
    balance: 1000000,
    monthlyPayment: 100000,
    annualRate: 12,
    extraPayment: 0,
  });
  assert.equal(result.baseline.months, 11);
  assert.ok(Math.abs(result.baseline.interest - 58984.88) < 0.01);
  assert.ok(Math.abs(result.baseline.totalPaid - 1058984.88) < 0.01);
  assert.ok(Math.abs(result.baseline.finalPayment - 58984.88) < 0.01);
});

test("matches independent golden values when a lump sum is applied after the regular payment", () => {
  const result = calculatePrepayment({
    balance: 1000000,
    monthlyPayment: 100000,
    annualRate: 12,
    extraPayment: 50000,
  });
  assert.equal(result.shorten.months, 11);
  assert.ok(Math.abs(result.shorten.interest - 53753.77) < 0.01);
  assert.ok(Math.abs(result.shorten.totalPaid - 1053753.77) < 0.01);
  assert.ok(Math.abs(result.shorten.finalPayment - 3753.77) < 0.01);
});

test("fully paid loan in the first period reports zero future required payment", async () => {
  const { calculatePlanOptions } = await import("../lib/prepayment.ts");
  const result = calculatePlanOptions({
    balance: 100000,
    monthlyPayment: 10000,
    annualRate: 12,
    lumpSum: 91000,
    monthlyExtra: 0,
  });
  assert.equal(result.lumpShorten.months, 1);
  assert.equal(result.lumpShorten.interest, 1000);
  assert.equal(result.lumpShorten.totalPaid, 101000);
  assert.equal(result.lumpReduce.months, 1);
  assert.equal(result.lumpReduce.requiredPayment, 0);
  assert.equal(result.lumpReduce.totalMonthlyOutflow, 0);
});

test("calendar estimate counts completed calendar months and rejects future or malformed dates", () => {
  const asOf = new Date(2024, 3, 15);
  const result = estimateRemainingBalance(1000000, 12, 15000, "2024-01", asOf);
  assert.equal(result.monthsPaid, 3);
  assert.ok(Math.abs(result.balance - 984849.5) < 0.01);
  assert.equal(estimateRemainingBalance(1000000, 12, 15000, "2024-04", asOf).monthsPaid, 0);
  assert.throws(() => estimateRemainingBalance(1000000, 12, 15000, "2024-13", asOf), /формате/);
  assert.throws(() => estimateRemainingBalance(1000000, 12, 15000, "2024-4", asOf), /формате/);
  assert.throws(() => estimateRemainingBalance(1000000, 12, 15000, "2024-05", asOf), /позже даты/);
  assert.throws(() => estimateRemainingBalance(1000000, 12, 15000, "2024-01", new Date("invalid")), /дату расчёта/);
});

test("rejects contradictory and out-of-range values before producing a result", () => {
  assert.throws(() => calculatePrepayment({ balance: 0, monthlyPayment: 10000, annualRate: 12, extraPayment: 0 }));
  assert.throws(() => calculatePrepayment({ balance: 1000000, monthlyPayment: 0, annualRate: 12, extraPayment: 0 }));
  assert.throws(() => calculatePrepayment({ balance: 1000000, monthlyPayment: 10000, annualRate: 30.01, extraPayment: 0 }));
  assert.throws(() => calculatePrepayment({ balance: 1000000, monthlyPayment: 10000, annualRate: 12, extraPayment: 1000001 }));
  assert.throws(() => calculatePrepayment({ balance: 1000000, monthlyPayment: 10000, annualRate: 12, extraPayment: NaN }));
  assert.throws(() => calculatePrepayment({ balance: 1000000, monthlyPayment: 10000, annualRate: 12, extraPayment: Infinity }));
});

test("zero-rate boundary has exact principal-only repayment", () => {
  const result = calculatePrepayment({
    balance: 120000,
    monthlyPayment: 10000,
    annualRate: 0,
    extraPayment: 20000,
  });
  assert.equal(result.baseline.months, 12);
  assert.equal(result.baseline.interest, 0);
  assert.equal(result.baseline.totalPaid, 120000);
  assert.equal(result.shorten.months, 10);
  assert.equal(result.shorten.interest, 0);
  assert.equal(result.shorten.totalPaid, 120000);
});
