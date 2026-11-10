import test from "node:test";
import assert from "node:assert/strict";
import {
  annuityPayment,
  inferRemainingTerm,
  simulateFixedPayment,
  simulateReducedPayment,
} from "../lib/prepayment-simulation.ts";
import {
  calculatePlanOptions,
  calculatePrepayment,
  estimateRemainingBalance,
} from "../lib/prepayment.ts";

// Deliberately independent recurrence: no production helpers are called here.
function oracle(balanceStart, annualRate, payment, monthlyExtra = 0, lump = 0, reduced = false) {
  const rate = annualRate / 1200;
  const exactTerm = rate === 0
    ? balanceStart / payment
    : -Math.log1p(-(balanceStart * rate) / payment) / Math.log1p(rate);
  let balance = balanceStart;
  let scheduled = payment;
  let interest = 0;
  let totalPaid = 0;
  let months = 0;
  let finalPayment = 0;
  let firstPayment = payment;
  while (balance > 0.005 && months < 600) {
    const accrued = balance * rate;
    if (scheduled <= accrued) throw new Error("oracle non-amortizing");
    const regular = Math.min(balance + accrued, scheduled);
    balance = Math.max(0, balance + accrued - regular);
    const extra = Math.min(balance, monthlyExtra + (months === 0 ? lump : 0));
    balance -= extra;
    interest += accrued;
    finalPayment = regular + extra;
    totalPaid += finalPayment;
    months++;
    if (balance <= 0.005) {
      if (reduced && months === 1) firstPayment = 0;
      break;
    }
    if (reduced) {
      const left = exactTerm - months;
      scheduled = left > 0
        ? (rate === 0 ? balance / left : balance * rate / (1 - Math.exp(-left * Math.log1p(rate))))
        : 0;
      if (months === 1) firstPayment = scheduled;
    }
  }
  return { months, interest, totalPaid, finalPayment, firstPayment, completed: balance <= 0.005 };
}

function close(actual, expected, label) {
  assert.equal(actual.completed, true, label + " completes");
  assert.equal(actual.months, expected.months, label + " months");
  assert.ok(Math.abs(actual.interest - expected.interest) <= 0.011, label + " interest");
  assert.ok(Math.abs(actual.totalPaid - expected.totalPaid) <= 0.011, label + " total paid");
  assert.ok(Math.abs(actual.finalPayment - expected.finalPayment) <= 0.011, label + " final payment");
}

test("deterministic stress matrix: 300 independent fixed/reduced schedule comparisons", () => {
  let seed = 0x51dca11;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let i = 0; i < 300; i++) {
    const balance = Math.round((10000 + random() * 4990000) * 100) / 100;
    const rate = Math.round(random() * 3000) / 100;
    const term = 12 + Math.floor(random() * 228);
    const monthlyRate = rate / 1200;
    const payment = Math.ceil((monthlyRate === 0
      ? balance / term
      : balance * monthlyRate / (1 - Math.pow(1 + monthlyRate, -term))) * (1.01 + random() * 0.5));
    const extraMonthly = Math.round(random() * Math.min(balance * 0.08, 30000) * 100) / 100;
    const lump = Math.round(random() * Math.min(balance * 0.15, 150000) * 100) / 100;
    const exactTerm = inferRemainingTerm(balance, rate, payment);
    const fixed = simulateFixedPayment(balance, rate, payment, extraMonthly, lump, exactTerm);
    const reduced = simulateReducedPayment(balance, rate, exactTerm, payment, extraMonthly, lump);
    close(fixed, oracle(balance, rate, payment, extraMonthly, lump), "case " + i + " fixed");
    close(reduced, oracle(balance, rate, payment, extraMonthly, lump, true), "case " + i + " reduced");
    assert.ok(fixed.interest <= oracle(balance, rate, payment).interest + 0.011);
    assert.ok(reduced.interest <= oracle(balance, rate, payment).interest + 0.011);
    assert.ok(Math.abs(fixed.totalPaid - (balance + fixed.interest)) <= 0.02);
    assert.ok(Math.abs(reduced.totalPaid - (balance + reduced.interest)) <= 0.02);
  }
});

test("zero-interest loans have exact linear schedules and no artificial interest", () => {
  for (const [balance, payment] of [[1, 0.25], [100000, 3000], [999999999, 50000000]]) {
    const term = inferRemainingTerm(balance, 0, payment);
    const plan = simulateFixedPayment(balance, 0, payment, 0, 0, term);
    assert.equal(plan.completed, true);
    assert.equal(plan.interest, 0);
    assert.ok(Math.abs(plan.totalPaid - balance) < 0.02);
    assert.equal(annuityPayment(balance, 0, term), balance / term);
  }
});

test("extra payments never increase interest and larger early extras are monotonic", () => {
  const base = { balance: 875000, monthlyPayment: 15000, annualRate: 11.7 };
  const none = calculatePrepayment({ ...base, extraPayment: 0 });
  let previousInterest = none.shorten.interest;
  for (const extraPayment of [1, 100, 1000, 10000, 50000, 100000, 250000]) {
    const result = calculatePrepayment({ ...base, extraPayment });
    assert.ok(result.shorten.interest <= previousInterest + 0.01);
    assert.ok(result.reduce.interest <= none.baseline.interest + 0.01);
    assert.ok(result.shorten.months <= none.baseline.months);
    previousInterest = result.shorten.interest;
  }
});

test("plan options correctly handle lump-only, monthly-only, both and no-extra cases", () => {
  const base = { balance: 900000, monthlyPayment: 20000, annualRate: 9.5 };
  const none = calculatePlanOptions({ ...base, lumpSum: 0, monthlyExtra: 0 });
  assert.equal(none.recommendation, null);
  const lump = calculatePlanOptions({ ...base, lumpSum: 50000, monthlyExtra: 0 });
  const monthly = calculatePlanOptions({ ...base, lumpSum: 0, monthlyExtra: 2000 });
  const both = calculatePlanOptions({ ...base, lumpSum: 50000, monthlyExtra: 2000 });
  assert.ok(lump.lumpShorten.interest < lump.baseline.interest);
  assert.ok(monthly.recurringShorten.interest < monthly.baseline.interest);
  assert.ok(both.combined.interest <= lump.lumpShorten.interest + 0.01);
  assert.ok(both.combined.interest <= monthly.recurringShorten.interest + 0.01);
  assert.ok(lump.recommendation);
  assert.ok(monthly.recommendation);
  assert.ok(both.recommendation);
});

test("public calculator rejects NaN, infinities, negatives and values beyond supported limits", () => {
  const valid = { balance: 500000, monthlyPayment: 12000, annualRate: 10, extraPayment: 1000 };
  for (const value of [NaN, Infinity, -Infinity, -1, 0]) {
    assert.throws(() => calculatePrepayment({ ...valid, balance: value }));
    assert.throws(() => calculatePrepayment({ ...valid, monthlyPayment: value }));
  }
  assert.throws(() => calculatePrepayment({ ...valid, annualRate: NaN }));
  assert.throws(() => calculatePrepayment({ ...valid, annualRate: Infinity }));
  assert.throws(() => calculatePrepayment({ ...valid, annualRate: -0.01 }));
  assert.throws(() => calculatePrepayment({ ...valid, annualRate: 30.01 }));
  assert.throws(() => calculatePrepayment({ ...valid, extraPayment: NaN }));
  assert.throws(() => calculatePrepayment({ ...valid, extraPayment: Infinity }));
  assert.throws(() => calculatePrepayment({ ...valid, balance: 1000000000 }));
  assert.throws(() => calculatePlanOptions({ ...valid, lumpSum: 0, monthlyExtra: NaN }));
});

test("calendar-based historical balance estimate validates dates and elapsed horizon", () => {
  const asOf = new Date(2026, 10, 10);
  assert.equal(estimateRemainingBalance(100000, 0, 10000, "2026-11", asOf).monthsPaid, 0);
  assert.equal(estimateRemainingBalance(100000, 0, 10000, "2026-10", asOf).monthsPaid, 1);
  for (const date of ["2026-00", "2026-13", "26-01", "2026-1", "2026/01", "", "2027-01"]) {
    assert.throws(() => estimateRemainingBalance(100000, 10, 5000, date, asOf));
  }
  assert.throws(() => estimateRemainingBalance(100000, 10, 5000, "1970-01", asOf), /слишком ранняя/);
  assert.throws(() => estimateRemainingBalance(100000, 10, 500, "2026-01", asOf), /не покрывает/);
});

test("inferred term is stable at zero rate and rejects exact non-amortizing boundary", () => {
  assert.equal(inferRemainingTerm(120000, 0, 10000), 12);
  assert.throws(() => inferRemainingTerm(100000, 12, 1000));
  assert.ok(inferRemainingTerm(100000, 12, 1000.01) > 0);
});

test("initial stub-period interest is day-based and independent of monthly accrual", () => {
  const principal = 1000000;
  const rate = 12;
  const days = 17;
  const term = inferRemainingTerm(principal, rate, 50000);
  const base = simulateFixedPayment(principal, rate, 50000, 0, 0, term);
  const stub = simulateFixedPayment(principal, rate, 50000, 0, 0, term, days);
  const expectedStub = principal * (rate / 100) * days / 365;
  assert.ok(Math.abs((stub.interest - base.interest) - expectedStub) < 0.011);
  assert.ok(Math.abs((stub.totalPaid - base.totalPaid) - expectedStub) < 0.011);
});
