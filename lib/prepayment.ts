export type PrepaymentInput = { balance: number; monthlyPayment: number; annualRate: number; extraPayment: number };
export type PrepaymentScenario = { monthlyPayment: number; months: number; interest: number; totalPaid: number; finalPayment: number };
export type PrepaymentResult = { baseline: PrepaymentScenario; shorten: PrepaymentScenario; reduce: PrepaymentScenario; appliedExtra: number; balanceAfterFirstPayment: number };
const MAX_MONTHS = 600;
const roundMoney = (n: number) => Math.round(n * 100) / 100;
function paymentFor(balance: number, rate: number, months: number) {
  return balance <= 0 || months <= 0 ? 0 : rate === 0 ? balance / months : balance * rate / (1 - Math.pow(1 + rate, -months));
}
function schedule(balance: number, payment: number, rate: number): PrepaymentScenario {
  let debt = balance, interestTotal = 0, totalPaid = 0, finalPayment = 0, months = 0;
  while (debt > 0.005 && months < MAX_MONTHS) {
    const interest = debt * rate, due = debt + interest, actual = Math.min(payment, due);
    if (actual <= interest + 0.000001) throw new Error("Ежемесячный платёж не покрывает проценты. Увеличьте платёж или проверьте ставку.");
    debt = Math.max(0, due - actual); interestTotal += interest; totalPaid += actual; finalPayment = actual; months++;
  }
  if (debt > 0.005) throw new Error("Срок кредита превышает 50 лет. Проверьте параметры.");
  return { monthlyPayment: roundMoney(payment), months, interest: roundMoney(interestTotal), totalPaid: roundMoney(totalPaid), finalPayment: roundMoney(finalPayment) };
}
export function calculatePrepayment(input: PrepaymentInput): PrepaymentResult {
  const { balance, monthlyPayment, annualRate, extraPayment } = input;
  if (!Number.isFinite(balance) || balance <= 0 || balance > 999999999) throw new Error("Укажите остаток долга от 0,01 до 999 999 999 ₽.");
  if (!Number.isFinite(monthlyPayment) || monthlyPayment <= 0) throw new Error("Укажите корректный ежемесячный платёж.");
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 30) throw new Error("Ставка должна быть от 0 до 30%.");
  if (!Number.isFinite(extraPayment) || extraPayment < 0 || extraPayment > 999999999) throw new Error("Проверьте сумму досрочного погашения.");
  const rate = annualRate / 1200, baseline = schedule(balance, monthlyPayment, rate);
  const interestFirst = balance * rate, afterRegular = Math.max(0, balance - Math.max(0, monthlyPayment - interestFirst));
  if (afterRegular <= 0) return { baseline, shorten: baseline, reduce: baseline, appliedExtra: 0, balanceAfterFirstPayment: 0 };
  const appliedExtra = Math.min(extraPayment, afterRegular), afterExtra = Math.max(0, afterRegular - appliedExtra);
  const remainingMonths = Math.max(1, baseline.months - 1);
  const zero: PrepaymentScenario = { monthlyPayment: 0, months: 0, interest: 0, totalPaid: 0, finalPayment: 0 };
  const shortenFuture = afterExtra > 0 ? schedule(afterExtra, monthlyPayment, rate) : zero;
  const shorten: PrepaymentScenario = { monthlyPayment: roundMoney(monthlyPayment), months: 1 + shortenFuture.months, interest: roundMoney(interestFirst + shortenFuture.interest), totalPaid: roundMoney(monthlyPayment + appliedExtra + shortenFuture.totalPaid), finalPayment: shortenFuture.months ? shortenFuture.finalPayment : roundMoney(monthlyPayment + appliedExtra) };
  const reducedPayment = paymentFor(afterExtra, rate, remainingMonths);
  const reduceFuture = afterExtra > 0 ? schedule(afterExtra, reducedPayment, rate) : zero;
  const reduce: PrepaymentScenario = { monthlyPayment: roundMoney(reducedPayment), months: 1 + reduceFuture.months, interest: roundMoney(interestFirst + reduceFuture.interest), totalPaid: roundMoney(monthlyPayment + appliedExtra + reduceFuture.totalPaid), finalPayment: reduceFuture.months ? reduceFuture.finalPayment : roundMoney(monthlyPayment + appliedExtra) };
  return { baseline, shorten, reduce, appliedExtra: roundMoney(appliedExtra), balanceAfterFirstPayment: roundMoney(afterExtra) };
}
export function estimateRemainingBalance(principal: number, annualRate: number, monthlyPayment: number, startDate: string, asOfDate = new Date()): { balance: number; monthsPaid: number } {
  if (!Number.isFinite(principal) || principal <= 0 || principal > 999999999) throw new Error("Проверьте первоначальную сумму кредита.");
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 30) throw new Error("Ставка должна быть от 0 до 30%.");
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
