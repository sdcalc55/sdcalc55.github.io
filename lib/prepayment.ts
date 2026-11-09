import { inferRemainingTerm, simulateFixedPayment, simulateReducedPayment } from "@/lib/prepayment-simulation";

export type PrepaymentInput = { balance: number; monthlyPayment: number; annualRate: number; extraPayment: number };
export type PrepaymentScenario = { monthlyPayment: number; months: number; interest: number; totalPaid: number; finalPayment: number };
export type PrepaymentResult = { baseline: PrepaymentScenario; shorten: PrepaymentScenario; reduce: PrepaymentScenario; appliedExtra: number; balanceAfterFirstPayment: number };
export type PlanScenario = PrepaymentScenario & { requiredPayment: number; monthlyExtra: number; totalMonthlyOutflow: number };
export type PlanOptions = { baseline: PrepaymentScenario; lumpShorten: PlanScenario; lumpReduce: PlanScenario; recurringShorten: PlanScenario; combined: PlanScenario; recommendation: "lumpShorten" | "lumpReduce" | "recurringShorten" | "combined" | null; };
const MAX_MONTHS = 600;
const roundMoney = (n: number) => Math.round(n * 100) / 100;

function toScenario(plan: ReturnType<typeof simulateFixedPayment>, monthlyPayment: number): PrepaymentScenario {
  if (!plan.completed) throw new Error("Не удалось завершить расчёт в пределах 50 лет. Проверьте параметры кредита.");
  return {
    monthlyPayment: roundMoney(monthlyPayment),
    months: plan.months,
    interest: roundMoney(plan.interest),
    totalPaid: roundMoney(plan.totalPaid),
    finalPayment: roundMoney(plan.finalPayment),
  };
}
function validate(balance: number, monthlyPayment: number, annualRate: number, extraPayment = 0) {
  if (!Number.isFinite(balance) || balance <= 0 || balance > 999999999) throw new Error("Укажите текущий остаток долга от 0,01 до 999 999 999 ₽.");
  if (!Number.isFinite(monthlyPayment) || monthlyPayment <= 0) throw new Error("Укажите корректный ежемесячный платёж.");
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 30) throw new Error("Ставка должна быть от 0 до 30%.");
  if (!Number.isFinite(extraPayment) || extraPayment < 0 || extraPayment > 999999999) throw new Error("Проверьте сумму досрочного погашения.");
}
export function calculatePrepayment(input: PrepaymentInput): PrepaymentResult {
  const { balance, monthlyPayment, annualRate, extraPayment } = input;
  validate(balance, monthlyPayment, annualRate, extraPayment);
  const term = inferRemainingTerm(balance, annualRate, monthlyPayment);
  const rate = annualRate / 1200;
  const baselinePlan = simulateFixedPayment(balance, annualRate, monthlyPayment, 0, 0, term);
  const baseline = toScenario(baselinePlan, monthlyPayment);
  const firstDue = balance * (1 + rate);
  const firstRegular = Math.min(monthlyPayment, firstDue);
  const afterRegular = Math.max(0, firstDue - firstRegular);
  const appliedExtra = Math.min(extraPayment, afterRegular);
  const balanceAfterFirstPayment = Math.max(0, afterRegular - appliedExtra);
  const shortenPlan = simulateFixedPayment(balance, annualRate, monthlyPayment, 0, appliedExtra, term);
  const reducePlan = simulateReducedPayment(balance, annualRate, term, monthlyPayment, 0, appliedExtra);
  const shorten = toScenario(shortenPlan, monthlyPayment);
  const reduce = toScenario(reducePlan, reducePlan.firstPayment);
  return {
    baseline,
    shorten,
    reduce,
    appliedExtra: roundMoney(appliedExtra),
    balanceAfterFirstPayment: roundMoney(balanceAfterFirstPayment),
  };
}

function planScenario(data: PrepaymentScenario, requiredPayment: number, monthlyExtra: number): PlanScenario {
  return { ...data, requiredPayment: roundMoney(requiredPayment), monthlyExtra: roundMoney(monthlyExtra), totalMonthlyOutflow: roundMoney(requiredPayment + monthlyExtra) };
}

/** Compares lump-sum, recurring and combined plans using the same fractional-term monthly simulation. */
export function calculatePlanOptions(input: { balance: number; monthlyPayment: number; annualRate: number; lumpSum: number; monthlyExtra: number }): PlanOptions {
  const { balance, monthlyPayment, annualRate, lumpSum, monthlyExtra } = input;
  validate(balance, monthlyPayment, annualRate, lumpSum);
  if (!Number.isFinite(monthlyExtra) || monthlyExtra < 0 || monthlyExtra > 999999999) throw new Error("Проверьте ежемесячную дополнительную сумму.");
  const term = inferRemainingTerm(balance, annualRate, monthlyPayment);
  const baseline = toScenario(simulateFixedPayment(balance, annualRate, monthlyPayment, 0, 0, term), monthlyPayment);
  const rate = annualRate / 1200;
  const afterRegular = Math.max(0, balance * (1 + rate) - Math.min(monthlyPayment, balance * (1 + rate)));
  const appliedLump = Math.min(lumpSum, afterRegular);

  const lumpShort = toScenario(
    simulateFixedPayment(balance, annualRate, monthlyPayment, 0, appliedLump, term),
    monthlyPayment,
  );
  const lumpReducePlan = simulateReducedPayment(balance, annualRate, term, monthlyPayment, 0, appliedLump);
  const lumpReduce = toScenario(lumpReducePlan, lumpReducePlan.firstPayment);
  const recurring = toScenario(
    simulateFixedPayment(balance, annualRate, monthlyPayment, monthlyExtra, 0, term),
    monthlyPayment,
  );
  const combined = toScenario(
    simulateFixedPayment(balance, annualRate, monthlyPayment, monthlyExtra, appliedLump, term),
    monthlyPayment,
  );

  const candidates: { key: NonNullable<PlanOptions["recommendation"]>; scenario: PrepaymentScenario }[] = [
    ...(appliedLump > 0 ? [{ key: "lumpShorten" as const, scenario: lumpShort }, { key: "lumpReduce" as const, scenario: lumpReduce }] : []),
    ...(monthlyExtra > 0 ? [{ key: "recurringShorten" as const, scenario: recurring }] : []),
    ...(appliedLump > 0 || monthlyExtra > 0 ? [{ key: "combined" as const, scenario: combined }] : []),
  ];
  const recommendation = candidates.length
    ? candidates.reduce((best, item) => item.scenario.interest < best.scenario.interest ? item : best).key
    : null;

  return {
    baseline,
    lumpShorten: planScenario(lumpShort, monthlyPayment, 0),
    lumpReduce: planScenario(lumpReduce, lumpReducePlan.firstPayment, 0),
    recurringShorten: planScenario(recurring, monthlyPayment, monthlyExtra),
    combined: planScenario(combined, monthlyPayment, monthlyExtra),
    recommendation,
  };
}
export function estimateRemainingBalance(principal: number, annualRate: number, monthlyPayment: number, startDate: string, asOfDate = new Date()): { balance: number; monthsPaid: number } {
  if (!Number.isFinite(principal) || principal <= 0 || principal > 999999999) throw new Error("Проверьте первоначальную сумму кредита.");
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 30) throw new Error("Проверьте процентную ставку.");
  if (!Number.isFinite(monthlyPayment) || monthlyPayment <= 0) throw new Error("Проверьте ежемесячный платёж.");
  const [year, month] = startDate.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) throw new Error("Укажите дату оформления кредита.");
  const elapsed = Math.max(0, (asOfDate.getFullYear() - year) * 12 + asOfDate.getMonth() + 1 - month);
  if (elapsed > MAX_MONTHS) throw new Error("Дата оформления кредита слишком ранняя.");
  const rate = annualRate / 1200; let balance = principal, monthsPaid = 0;
  for (let i = 0; i < elapsed && balance > 0.005; i++) {
    const interest = balance * rate;
    if (monthlyPayment <= interest) throw new Error("Указанный платёж не покрывает начисленные проценты.");
    balance = Math.max(0, balance + interest - monthlyPayment); monthsPaid++;
  }
  return { balance: roundMoney(balance), monthsPaid };
}
export type PlannerGoal = "payment" | "months" | "interest";
export function findPrepaymentAmount(input: Omit<PrepaymentInput, "extraPayment">, goal: PlannerGoal, target: number): number {
  if (!Number.isFinite(target) || target <= 0) throw new Error("Укажите желаемый результат.");
  const baseline = calculatePrepayment({ ...input, extraPayment: 0 }), max = input.balance;
  const meets = (extra: number) => {
    const r = calculatePrepayment({ ...input, extraPayment: extra });
    if (goal === "payment") return r.reduce.monthlyPayment <= target;
    if (goal === "months") return r.shorten.months <= baseline.baseline.months - Math.floor(target);
    return baseline.baseline.interest - r.shorten.interest >= target;
  };
  if (!meets(max)) throw new Error("Даже при полном погашении заданная цель недостижима в выбранных условиях.");
  let low = 0, high = max;
  for (let i = 0; i < 60; i++) { const mid = (low + high) / 2; if (meets(mid)) high = mid; else low = mid; }
  return Math.ceil(high);
}
