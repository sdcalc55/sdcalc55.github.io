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


// Golden values below were calculated independently from the recurrence and rechecked against full monthly periods:
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


test("fractional inferred term never creates fractional interest accrual", () => {
  const balance = 4500000, payment = 42000, annualRate = 6;
  const term = inferRemainingTerm(balance, annualRate, payment);
  assert.ok(term > 153 && term < 154);
  const plan = simulateFixedPayment(balance, annualRate, payment, 0, 0, term);
  assert.equal(plan.months, 154);
  assert.ok(Math.abs(plan.interest - 1961056.72) < 0.01);
  assert.ok(Math.abs(plan.totalPaid - 6461056.72) < 0.01);
  assert.ok(Math.abs(plan.finalPayment - 35056.72) < 0.01);
});

test("recalculated payment preserves the original schedule when no early payment exists", () => {
  const balance = 4500000, payment = 42000, annualRate = 6;
  const term = inferRemainingTerm(balance, annualRate, payment);
  const plan = simulateReducedPayment(balance, annualRate, term, payment, 0, 0);
  assert.equal(plan.firstPayment, payment);
  assert.equal(plan.months, 154);
  assert.ok(Math.abs(plan.interest - 1961056.72) < 0.01);
});


// Independent oracle: intentionally does not import or call production simulation helpers.
function referenceFixedSchedule(balance, annualRate, payment, firstPeriodExtra = 0) {
  const monthlyRate = annualRate / 1200;
  let interest = 0, totalPaid = 0, months = 0, finalPayment = 0;
  while (balance > 0.005 && months < 600) {
    const accrued = balance * monthlyRate;
    const due = balance + accrued;
    const regular = Math.min(due, payment);
    if (regular <= accrued + 1e-9) throw new Error("Reference case does not amortize");
    interest += accrued;
    balance = Math.max(0, due - regular);
    const extra = months === 0 ? Math.min(balance, firstPeriodExtra) : 0;
    balance = Math.max(0, balance - extra);
    finalPayment = regular + extra;
    totalPaid += finalPayment;
    months++;
  }
  if (balance > 0.005) throw new Error("Reference case exceeds 600 months");
  return {
    months,
    interest: Math.round((interest + Number.EPSILON) * 100) / 100,
    totalPaid: Math.round((totalPaid + Number.EPSILON) * 100) / 100,
    finalPayment: Math.round((finalPayment + Number.EPSILON) * 100) / 100,
  };
}

test("matches independent monthly-recurrence oracle across adversarial principal, rate and payment combinations", () => {
  const cases = [
    { balance: 1, monthlyPayment: 2, annualRate: 0, extraPayment: 0 },
    { balance: 999999999, monthlyPayment: 50000000, annualRate: 30, extraPayment: 1000000 },
    { balance: 999999.99, monthlyPayment: 10000, annualRate: 0.01, extraPayment: 0.01 },
    { balance: 1000000, monthlyPayment: 100000, annualRate: 12, extraPayment: 50000 },
    { balance: 4500000, monthlyPayment: 42000, annualRate: 6, extraPayment: 100000 },
    { balance: 250000, monthlyPayment: 8000, annualRate: 29.99, extraPayment: 249999 },
    { balance: 1234567.89, monthlyPayment: 23456.78, annualRate: 17.45, extraPayment: 7654.32 },
    { balance: 500000, monthlyPayment: 500000, annualRate: 30, extraPayment: 500000 },
  ];
  for (const input of cases) {
    const result = calculatePrepayment(input);
    const expectedBase = referenceFixedSchedule(input.balance, input.annualRate, input.monthlyPayment);
    const firstDue = input.balance * (1 + input.annualRate / 1200);
    const afterRegular = Math.max(0, firstDue - Math.min(input.monthlyPayment, firstDue));
    const appliedExtra = Math.min(input.extraPayment, afterRegular);
    const expectedShorten = referenceFixedSchedule(input.balance, input.annualRate, input.monthlyPayment, appliedExtra);
    for (const [actual, expected, scenario] of [
      [result.baseline, expectedBase, "baseline"],
      [result.shorten, expectedShorten, "shorten"],
    ]) {
      assert.equal(actual.months, expected.months, JSON.stringify({ input, scenario }));
      assert.ok(Math.abs(actual.interest - expected.interest) <= 0.01, JSON.stringify({ input, scenario, field: "interest", actual: actual.interest, expected: expected.interest }));
      assert.ok(Math.abs(actual.totalPaid - expected.totalPaid) <= 0.01, JSON.stringify({ input, scenario, field: "totalPaid", actual: actual.totalPaid, expected: expected.totalPaid }));
      assert.ok(Math.abs(actual.finalPayment - expected.finalPayment) <= 0.01, JSON.stringify({ input, scenario, field: "finalPayment", actual: actual.finalPayment, expected: expected.finalPayment }));
      assert.ok(Math.abs(actual.totalPaid - (input.balance + actual.interest)) <= 0.02, JSON.stringify({ input, scenario, field: "accounting identity" }));
    }
  }
});


// Independent reduced-payment oracle: the regular installment is recalculated
// after the regular payment and the additional amount is then accounted for
// separately. It intentionally does not call production annuity/simulation code.
function referenceAnnuityPayment(balance, monthlyRate, periods) {
  if (monthlyRate === 0) return balance / periods;
  return balance * monthlyRate / (1 - Math.pow(1 + monthlyRate, -periods));
}

function referenceSchedule({ balance, annualRate, monthlyPayment, monthlyExtra = 0, lump = 0, reduced = false }) {
  const rate = annualRate / 1200;
  const exactTerm = rate === 0
    ? balance / monthlyPayment
    : -Math.log(1 - balance * rate / monthlyPayment) / Math.log(1 + rate);
  const periods = Math.ceil(exactTerm - 1e-10);
  let remaining = balance, scheduled = monthlyPayment, interest = 0, totalPaid = 0, months = 0, finalPayment = 0;
  let firstRecalculatedPayment = monthlyPayment;
  while (remaining > 0.005 && months < periods) {
    const accrued = remaining * rate;
    const mandatory = Math.min(remaining + accrued, scheduled);
    if (mandatory <= accrued) throw new Error("Reference schedule does not amortize");
    interest += accrued;
    remaining = Math.max(0, remaining + accrued - mandatory);
    const extra = Math.min(remaining, monthlyExtra + (months === 0 ? lump : 0));
    remaining = Math.max(0, remaining - extra);
    finalPayment = mandatory + extra;
    totalPaid += finalPayment;
    months++;
    if (remaining <= 0.005) {
      if (months === 1 && reduced) firstRecalculatedPayment = 0;
      break;
    }
    if (reduced) {
      const left = exactTerm - months;
      scheduled = left > 0 ? referenceAnnuityPayment(remaining, rate, left) : 0;
      if (months === 1) firstRecalculatedPayment = scheduled;
    }
  }
  assert.ok(remaining <= 0.005, "independent schedule must close within the 50-year horizon");
  return {
    months,
    interest: Math.round(interest * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    finalPayment: Math.round(finalPayment * 100) / 100,
    firstPayment: firstRecalculatedPayment,
  };
}

test("all active repayment scenarios match an independent monthly oracle", () => {
  const cases = [
    { balance: 1000000, monthlyPayment: 100000, annualRate: 12, monthlyExtra: 5000, lump: 50000 },
    { balance: 4500000, monthlyPayment: 42000, annualRate: 6, monthlyExtra: 5000, lump: 100000 },
    { balance: 120000, monthlyPayment: 10000, annualRate: 0, monthlyExtra: 1000, lump: 5000 },
    { balance: 250000, monthlyPayment: 8000, annualRate: 29.99, monthlyExtra: 1000, lump: 10000 },
    { balance: 999999999, monthlyPayment: 50000000, annualRate: 30, monthlyExtra: 1000000, lump: 1000000 },
  ];
  for (const input of cases) {
    const term = inferRemainingTerm(input.balance, input.annualRate, input.monthlyPayment);
    const baseline = simulateFixedPayment(input.balance, input.annualRate, input.monthlyPayment, 0, 0, term);
    const shorten = simulateFixedPayment(input.balance, input.annualRate, input.monthlyPayment, input.monthlyExtra, input.lump, term);
    const reduce = simulateReducedPayment(input.balance, input.annualRate, term, input.monthlyPayment, input.monthlyExtra, input.lump);
    const expectedBase = referenceSchedule({ ...input, monthlyExtra: 0, lump: 0 });
    const expectedShorten = referenceSchedule({ ...input });
    const expectedReduce = referenceSchedule({ ...input, reduced: true });
    for (const [actual, expected, name] of [
      [baseline, expectedBase, "baseline"],
      [shorten, expectedShorten, "shorten"],
      [reduce, expectedReduce, "reduce"],
    ]) {
      assert.equal(actual.completed, true, name);
      assert.equal(actual.months, expected.months, name + " months");
      assert.ok(Math.abs(actual.interest - expected.interest) <= 0.01, name + " interest " + JSON.stringify({ input, actual: actual.interest, expected: expected.interest }));
      assert.ok(Math.abs(actual.totalPaid - expected.totalPaid) <= 0.01, name + " totalPaid");
      assert.ok(Math.abs(actual.finalPayment - expected.finalPayment) <= 0.01, name + " finalPayment");
      assert.ok(Math.abs(actual.totalPaid - (input.balance + actual.interest)) <= 0.02, name + " accounting identity");
    }
    assert.ok(shorten.interest <= baseline.interest + 0.01, "shorten scenario cannot increase interest");
    assert.ok(reduce.interest <= baseline.interest + 0.01, "reduce scenario cannot increase interest");
    assert.ok(shorten.totalPaid >= input.balance, "mandatory and extra payments cannot underpay principal");
  }
});

test("one-kopeck balance, exact final-month payoff and maximum principal boundaries", () => {
  const oneKopeck = simulateFixedPayment(0.01, 0, 1, 0, 0, 1);
  assert.equal(oneKopeck.completed, true);
  assert.equal(oneKopeck.months, 1);
  assert.equal(oneKopeck.totalPaid, 0.01);

  const exactLastMonth = simulateFixedPayment(1200, 0, 400, 0, 0, 3);
  assert.equal(exactLastMonth.completed, true);
  assert.equal(exactLastMonth.months, 3);
  assert.equal(exactLastMonth.totalPaid, 1200);
  assert.equal(exactLastMonth.finalPayment, 400);

  const maxPrincipal = simulateFixedPayment(999999999, 0, 50000000, 0, 0, 20);
  assert.equal(maxPrincipal.completed, true);
  assert.equal(maxPrincipal.totalPaid, 999999999);
  assert.equal(maxPrincipal.interest, 0);
});

test("additional payments remain separate from the mandatory installment", () => {
  const balance = 1000000, payment = 100000, annualRate = 12, extra = 50000;
  const term = inferRemainingTerm(balance, annualRate, payment);
  const plan = simulateFixedPayment(balance, annualRate, payment, extra, 0, term);
  const firstInterest = balance * annualRate / 1200;
  assert.equal(plan.firstPayment, payment);
  assert.ok(plan.totalPaid > payment);
  assert.ok(plan.totalPaid > payment);
  assert.ok(firstInterest < payment);
});

// Golden values copied from the supplied RUR workbook example and independently
// recomputed from its row-10 daily-interest formula plus the monthly amortization recurrence.
test("matches the workbook's initial daily-interest period and recurring early repayments", () => {
  const principal = 1999750;
  const annualRate = 17.45;
  const monthlyPayment = 30018.593345599038;
  const monthlyExtra = 3000;
  const initialPeriodDays = 16;
  const term = inferRemainingTerm(principal, annualRate, monthlyPayment);
  assert.ok(Math.abs(term - 240) < 1e-8);
  const plan = simulateFixedPayment(principal, annualRate, monthlyPayment, monthlyExtra, 0, term, initialPeriodDays);
  assert.equal(plan.months, 148);
  assert.ok(Math.abs(plan.interest - 2878335.587699058) < 0.02);
  assert.ok(Math.abs(plan.totalPaid - 4878085.587699065) < 0.02);
  assert.ok(Math.abs(plan.interest - (2863038.8698908486 + principal * 0.1745 * 16 / 365)) < 0.02);
});

test("rejects impossible initial calendar-period lengths", () => {
  const term = inferRemainingTerm(100000, 12, 10000);
  assert.throws(() => simulateFixedPayment(100000, 12, 10000, 0, 0, term, -1), /от 0 до 366/);
  assert.throws(() => simulateReducedPayment(100000, 12, term, 10000, 0, 0, 1.5), /от 0 до 366/);
});

test("contradictory direct simulation inputs are rejected", () => {
  assert.throws(() => simulateFixedPayment(100000, 12, 100, 0, 0), /не покрывает проценты/);
  assert.throws(() => simulateFixedPayment(100000, 12, 10000, 100001, 0), /не может превышать остаток долга/);
  assert.throws(() => simulateFixedPayment(100000, 12, 10000, 0, 100001), /не может превышать остаток долга/);
  assert.throws(() => simulateFixedPayment(0, 12, 10000, 0, 0), /остаток основного долга/);
  assert.throws(() => simulateFixedPayment(100000, 30.01, 10000, 0, 0), /от 0 до 30/);
  assert.throws(() => simulateFixedPayment(999999999, 0, 100000, 0, 0, 601), /не превышать 600 месяцев/);
});
