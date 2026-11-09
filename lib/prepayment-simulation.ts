export type RepaymentPlan = { months: number; interest: number; totalPaid: number; firstPayment: number; finalPayment: number; completed: boolean };
const MAX_MONTHS = 600;
const EPSILON = 0.005;
const MAX_AMOUNT = 999999999;

function validateSimulationInputs(balance: number, annualRate: number, payment: number, extraMonthly: number, lump: number) {
  if (!Number.isFinite(balance) || balance <= 0 || balance > MAX_AMOUNT) throw new Error("Проверьте остаток основного долга.");
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 30) throw new Error("Процентная ставка должна быть от 0 до 30%.");
  if (!Number.isFinite(payment) || payment <= 0 || payment > MAX_AMOUNT) throw new Error("Ежемесячный платёж должен быть больше нуля и не превышать 999 999 999 ₽.");
  if (!Number.isFinite(extraMonthly) || extraMonthly < 0 || extraMonthly > balance) throw new Error("Ежемесячный досрочный платёж не может превышать остаток долга.");
  if (!Number.isFinite(lump) || lump < 0 || lump > balance) throw new Error("Разовый досрочный платёж не может превышать остаток долга.");
}

export function annuityPayment(balance: number, monthlyRate: number, months: number): number {
  if (!Number.isFinite(balance) || balance <= 0 || !Number.isFinite(months) || months <= 0) return 0;
  if (!Number.isFinite(monthlyRate) || monthlyRate < 0) throw new Error("Некорректная процентная ставка для пересчёта платежа.");
  if (monthlyRate === 0) return balance / months;
  const logFactor = months * Math.log1p(monthlyRate);
  const denominator = -Math.expm1(-logFactor);
  return balance * monthlyRate / denominator;
}

/** Returns the exact mathematical annuity term; simulation still accrues interest in full monthly periods. No fractional interest periods are simulated. */
export function inferRemainingTerm(balance: number, annualRate: number, payment: number): number {
  if (!Number.isFinite(balance) || balance <= 0 || balance > MAX_AMOUNT) throw new Error("Проверьте остаток основного долга.");
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 30) throw new Error("Процентная ставка должна быть от 0 до 30%.");
  if (!Number.isFinite(payment) || payment <= 0 || payment > MAX_AMOUNT) throw new Error("Ежемесячный платёж должен быть больше нуля.");
  const rate = annualRate / 1200;
  if (payment <= balance * rate + 1e-9) throw new Error("Ежемесячный платёж не покрывает проценты по кредиту: он должен быть больше начисляемых процентов.");
  const exact = rate === 0 ? balance / payment : -Math.log1p(-(balance * rate) / payment) / Math.log1p(rate);
  if (!Number.isFinite(exact) || exact <= 0 || exact > MAX_MONTHS) throw new Error("Расчётный срок превышает 50 лет. Увеличьте ежемесячный платёж.");
  return exact;
}

function accrueMonthlyInterest(balance: number, monthlyRate: number): number {
  return balance * monthlyRate;
}

function validateTerm(termMonths: number) {
  if (!Number.isFinite(termMonths) || termMonths <= 0 || termMonths > MAX_MONTHS) {
    throw new Error("Расчётный срок должен быть больше 0 и не превышать 600 месяцев.");
  }
}

/** Fixed mandatory payment remains unchanged; extra payments are applied after it on each monthly payment date. */
export function simulateFixedPayment(
  balanceStart: number,
  annualRate: number,
  payment: number,
  extraMonthly = 0,
  lump = 0,
  termMonths = inferRemainingTerm(balanceStart, annualRate, payment),
  initialPeriodDays = 0,
): RepaymentPlan {
  validateSimulationInputs(balanceStart, annualRate, payment, extraMonthly, lump);
  validateTerm(termMonths);
  if (!Number.isInteger(initialPeriodDays) || initialPeriodDays < 0 || initialPeriodDays > 366) throw new Error("Количество дней начального периода должно быть от 0 до 366.");
  const initialInterest = balanceStart * (annualRate / 100) * initialPeriodDays / 365;
  let balance = balanceStart, interest = initialInterest, totalPaid = initialInterest, finalPayment = 0, months = 0;
  const rate = annualRate / 1200;
  for (let i = 0; i < Math.ceil(termMonths - 1e-10) && balance > EPSILON; i++) {
    const accrued = accrueMonthlyInterest(balance, rate);
    const due = balance + accrued;
    const regular = Math.min(due, payment);
    if (regular <= accrued + 1e-9) break;
    interest += accrued;
    balance = Math.max(0, due - regular);
    const extra = Math.min(balance, extraMonthly + (i === 0 ? lump : 0));
    balance = Math.max(0, balance - extra);
    finalPayment = regular + extra;
    totalPaid += finalPayment;
    months++;
  }
  return { months, interest, totalPaid, firstPayment: months ? Math.min(balanceStart * (1 + rate), payment) : 0, finalPayment, completed: balance <= EPSILON };
}

/** Recalculates the required payment over the exact remaining amortization term; interest still accrues only in full monthly periods. */
export function simulateReducedPayment(
  balanceStart: number,
  annualRate: number,
  termMonths: number,
  initialPayment: number,
  extraMonthly = 0,
  lump = 0,
  initialPeriodDays = 0,
): RepaymentPlan {
  validateSimulationInputs(balanceStart, annualRate, initialPayment, extraMonthly, lump);
  validateTerm(termMonths);
  if (!Number.isInteger(initialPeriodDays) || initialPeriodDays < 0 || initialPeriodDays > 366) throw new Error("Количество дней начального периода должно быть от 0 до 366.");
  const initialInterest = balanceStart * (annualRate / 100) * initialPeriodDays / 365;
  if (extraMonthly === 0 && lump === 0) {
    const unchanged = simulateFixedPayment(balanceStart, annualRate, initialPayment, 0, 0, termMonths);
    return { ...unchanged, interest: unchanged.interest + initialInterest, totalPaid: unchanged.totalPaid + initialInterest, firstPayment: initialPayment };
  }
  let balance = balanceStart, interest = initialInterest, totalPaid = initialInterest, months = 0, finalPayment = 0;
  let scheduledPayment = initialPayment, firstPayment = initialPayment;
  const rate = annualRate / 1200;
  for (let i = 0; i < termMonths && balance > EPSILON; i++) {
    const accrued = accrueMonthlyInterest(balance, rate);
    const due = balance + accrued;
    const regular = Math.min(due, scheduledPayment);
    if (regular <= accrued + 1e-9) break;
    interest += accrued;
    balance = Math.max(0, due - regular);
    const extra = Math.min(balance, extraMonthly + (i === 0 ? lump : 0));
    balance = Math.max(0, balance - extra);
    finalPayment = regular + extra;
    totalPaid += finalPayment;
    months++;
    if (balance <= EPSILON) {
      if (months === 1) firstPayment = 0;
      break;
    }
    const remainingTerm = termMonths - months;
    scheduledPayment = remainingTerm > 0 ? annuityPayment(balance, rate, remainingTerm) : 0;
    if (months === 1) firstPayment = scheduledPayment;
  }
  return { months, interest, totalPaid, firstPayment, finalPayment, completed: balance <= EPSILON };
}
