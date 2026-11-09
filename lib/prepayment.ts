import { inferRemainingTerm, simulateFixedPayment, simulateReducedPayment } from "./prepayment-simulation.ts";

export type PrepaymentInput = { balance: number; monthlyPayment: number; annualRate: number; extraPayment: number };
export type PrepaymentScenario = { monthlyPayment: number; months: number; interest: number; totalPaid: number; finalPayment: number };
export type PrepaymentResult = { baseline: PrepaymentScenario; shorten: PrepaymentScenario; reduce: PrepaymentScenario; appliedExtra: number; balanceAfterFirstPayment: number };
export type PlanScenario = PrepaymentScenario & { requiredPayment: number; monthlyExtra: number; totalMonthlyOutflow: number };
export type PlanOptions = { baseline: PrepaymentScenario; lumpShorten: PlanScenario; lumpReduce: PlanScenario; recurringShorten: PlanScenario; combined: PlanScenario; recommendation: "lumpShorten" | "lumpReduce" | "recurringShorten" | "combined" | null };
const MAX_MONTHS = 600;
const MAX_AMOUNT = 999999999;
const roundMoney = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function toScenario(plan: ReturnType<typeof simulateFixedPayment> | ReturnType<typeof simulateReducedPayment>, monthlyPayment: number): PrepaymentScenario {
  if (!plan.completed) throw new Error("Не удалось завершить расчёт в пределах 50 лет. Проверьте параметры кредита и платежа.");
  return { monthlyPayment: roundMoney(monthlyPayment), months: plan.months, interest: roundMoney(plan.interest), totalPaid: roundMoney(plan.totalPaid), finalPayment: roundMoney(plan.finalPayment) };
}
function validate(balance: number, monthlyPayment: number, annualRate: number, extraPayment = 0) {
  if (!Number.isFinite(balance) || balance <= 0 || balance > MAX_AMOUNT) throw new Error("Укажите текущий остаток долга от 0,01 до 999 999 999 ₽.");
  if (!Number.isFinite(monthlyPayment) || monthlyPayment <= 0 || monthlyPayment > MAX_AMOUNT) throw new Error("Укажите корректный ежемесячный платёж.");
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 30) throw new Error("Ставка должна быть от 0 до 30%.");
  if (!Number.isFinite(extraPayment) || extraPayment < 0 || extraPayment > balance) throw new Error("Разовый досрочный платёж не может превышать текущий остаток долга.");
}
export function calculatePrepayment(input: PrepaymentInput): PrepaymentResult {
  const { balance, monthlyPayment, annualRate, extraPayment } = input;
  validate(balance, monthlyPayment, annualRate, extraPayment);
  const term = inferRemainingTerm(balance, annualRate, monthlyPayment);
  const rate = annualRate / 1200;
  const firstDue = balance * (1 + rate);
  const firstRegular = Math.min(monthlyPayment, firstDue);
  const afterRegular = Math.max(0, firstDue - firstRegular);
  const appliedExtra = Math.min(extraPayment, afterRegular);
  const balanceAfterFirstPayment = Math.max(0, afterRegular - appliedExtra);
  const baseline = toScenario(simulateFixedPayment(balance, annualRate, monthlyPayment, 0, 0, term), monthlyPayment);
  const shortenPlan = simulateFixedPayment(balance, annualRate, monthlyPayment, 0, appliedExtra, term);
  const reducePlan = simulateReducedPayment(balance, annualRate, term, monthlyPayment, 0, appliedExtra);
  const shorten = toScenario(shortenPlan, monthlyPayment);
  const reduce = toScenario(reducePlan, reducePlan.firstPayment);
  return { baseline, shorten, reduce, appliedExtra: roundMoney(appliedExtra), balanceAfterFirstPayment: roundMoney(balanceAfterFirstPayment) };
}
function planScenario(data: PrepaymentScenario, requiredPayment: number, monthlyExtra: number): PlanScenario {
  const actualExtra = Math.min(monthlyExtra, Math.max(0, data.totalPaid)); // descriptive ceiling only; scenario simulation caps each period
  return { ...data, requiredPayment: roundMoney(requiredPayment), monthlyExtra: roundMoney(actualExtra), totalMonthlyOutflow: roundMoney(requiredPayment + actualExtra) };
}
export function calculatePlanOptions(input: { balance: number; monthlyPayment: number; annualRate: number; lumpSum: number; monthlyExtra: number }): PlanOptions {
  const { balance, monthlyPayment, annualRate, lumpSum, monthlyExtra } = input;
  validate(balance, monthlyPayment, annualRate, lumpSum);
  if (!Number.isFinite(monthlyExtra) || monthlyExtra < 0 || monthlyExtra > balance) throw new Error("Ежемесячный досрочный платёж не может превышать текущий остаток долга.");
  const term = inferRemainingTerm(balance, annualRate, monthlyPayment);
  const baseline = toScenario(simulateFixedPayment(balance, annualRate, monthlyPayment, 0, 0, term), monthlyPayment);
  const firstDue = balance * (1 + annualRate / 1200);
  const afterRegular = Math.max(0, firstDue - Math.min(monthlyPayment, firstDue));
  const appliedLump = Math.min(lumpSum, afterRegular);
  const lumpShort = toScenario(simulateFixedPayment(balance, annualRate, monthlyPayment, 0, appliedLump, term), monthlyPayment);
  const lumpReducePlan = simulateReducedPayment(balance, annualRate, term, monthlyPayment, 0, appliedLump);
  const lumpReduce = toScenario(lumpReducePlan, lumpReducePlan.firstPayment);
  const recurringPlan = simulateFixedPayment(balance, annualRate, monthlyPayment, monthlyExtra, 0, term);
  const recurring = toScenario(recurringPlan, monthlyPayment);
  const combined = toScenario(simulateFixedPayment(balance, annualRate, monthlyPayment, monthlyExtra, appliedLump, term), monthlyPayment);
  const candidates: { key: NonNullable<PlanOptions["recommendation"]>; scenario: PrepaymentScenario }[] = [
    ...(appliedLump > 0 ? [{ key: "lumpShorten" as const, scenario: lumpShort }, { key: "lumpReduce" as const, scenario: lumpReduce }] : []),
    ...(monthlyExtra > 0 ? [{ key: "recurringShorten" as const, scenario: recurring }] : []),
    ...(appliedLump > 0 || monthlyExtra > 0 ? [{ key: "combined" as const, scenario: combined }] : []),
  ].filter(item => item.scenario.interest < baseline.interest - 0.005);
  const recommendation = candidates.length ? candidates.reduce((best, item) => item.scenario.interest < best.scenario.interest ? item : best).key : null;
  const firstMonthlyExtra = Math.min(monthlyExtra, Math.max(0, balanceAfterRegular(balance, annualRate, monthlyPayment)));
  return {
    baseline,
    lumpShorten: planScenario(lumpShort, monthlyPayment, 0),
    lumpReduce: planScenario(lumpReduce, lumpReducePlan.firstPayment, 0),
    recurringShorten: planScenario(recurring, monthlyPayment, firstMonthlyExtra),
    combined: planScenario(combined, monthlyPayment, firstMonthlyExtra),
    recommendation,
  };
}
function balanceAfterRegular(balance: number, annualRate: number, payment: number) {
  const due = balance * (1 + annualRate / 1200);
  return Math.max(0, due - Math.min(payment, due));
}
export function estimateRemainingBalance(principal: number, annualRate: number, monthlyPayment: number, startDate: string, asOfDate = new Date()): { balance: number; monthsPaid: number } {
  if (!Number.isFinite(principal) || principal <= 0 || principal > MAX_AMOUNT) throw new Error("Проверьте первоначальную сумму кредита.");
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 30) throw new Error("Проверьте процентную ставку.");
  if (!Number.isFinite(monthlyPayment) || monthlyPayment <= 0 || monthlyPayment > MAX_AMOUNT) throw new Error("Проверьте ежемесячный платёж.");
  if (!(asOfDate instanceof Date) || !Number.isFinite(asOfDate.getTime())) throw new Error("Не удалось определить дату расчёта.");
  const match = typeof startDate === "string" ? startDate.match(/^(\d{4})-(0[1-9]|1[0-2])$/) : null;
  if (!match) throw new Error("Укажите дату оформления кредита в формате ГГГГ-ММ.");
  const year = Number(match[1]), month = Number(match[2]);
  const elapsed = (asOfDate.getFullYear() - year) * 12 + (asOfDate.getMonth() + 1 - month);
  if (elapsed < 0) throw new Error("Дата оформления кредита не может быть позже даты расчёта.");
  if (elapsed > MAX_MONTHS) throw new Error("Дата оформления кредита слишком ранняя.");
  const rate = annualRate / 1200;
  let balance = principal, monthsPaid = 0;
  for (let i = 0; i < elapsed && balance > 0.005; i++) {
    const interest = balance * rate;
    if (monthlyPayment <= interest + 1e-9) throw new Error("Указанный платёж не покрывает начисленные проценты.");
    balance = Math.max(0, balance + interest - monthlyPayment);
    monthsPaid++;
  }
  return { balance: roundMoney(balance), monthsPaid };
}
export type PlannerGoal = "payment" | "months" | "interest";
export function findPrepaymentAmount(input: Omit<PrepaymentInput, "extraPayment">, goal: PlannerGoal, target: number): number {
  if (!["payment", "months", "interest"].includes(goal)) throw new Error("Неизвестная цель расчёта досрочного погашения.");
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
