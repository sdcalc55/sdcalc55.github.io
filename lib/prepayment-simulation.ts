export type RepaymentPlan = { months: number; interest: number; firstPayment: number; completed: boolean };
const MAX_MONTHS = 600;
const EPSILON = 0.005;

function validateSimulationInputs(balance: number, annualRate: number, payment: number, extraMonthly: number, lump: number) {
  if (!Number.isFinite(balance) || balance <= 0) throw new Error("Остаток долга должен быть больше нуля.");
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 30) throw new Error("Проверьте процентную ставку.");
  if (!Number.isFinite(payment) || payment <= 0) throw new Error("Платёж должен быть больше нуля.");
  if (!Number.isFinite(extraMonthly) || extraMonthly < 0 || extraMonthly > balance) {
    throw new Error("Ежемесячный досрочный платёж не может превышать остаток долга.");
  }
  if (!Number.isFinite(lump) || lump < 0 || lump > balance) {
    throw new Error("Разовый досрочный платёж не может превышать остаток долга.");
  }
}

export function annuityPayment(balance: number, monthlyRate: number, months: number): number {
  if (balance <= 0 || months <= 0) return 0;
  if (monthlyRate === 0) return balance / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return balance * monthlyRate * factor / (factor - 1);
}

/** Infers a fractional mathematical term from balance, rate and current payment. */
export function inferRemainingTerm(balance: number, annualRate: number, payment: number): number {
  const rate = annualRate / 1200;
  if (balance <= 0 || payment <= 0 || payment <= balance * rate) {
    throw new Error("Платёж должен быть больше начисляемых процентов.");
  }
  if (rate === 0) return balance / payment;
  return -Math.log(1 - (balance * rate) / payment) / Math.log(1 + rate);
}

function periodInterest(balance: number, rate: number, period: number): number {
  return balance * (Math.pow(1 + rate, period) - 1);
}

/**
 * Monthly annuity model with a fractional final period inferred from the entered
 * balance/payment/rate. This keeps the no-prepayment baseline anchored to the
 * entered payment instead of silently replacing it with a rounded-month annuity.
 */
export function simulateFixedPayment(
  balanceStart: number,
  annualRate: number,
  payment: number,
  extraMonthly = 0,
  lump = 0,
  termMonths = inferRemainingTerm(balanceStart, annualRate, payment),
): RepaymentPlan {
  validateSimulationInputs(balanceStart, annualRate, payment, extraMonthly, lump);
  let balance = balanceStart, interest = 0, months = 0;
  const rate = annualRate / 1200;
  if (balance <= EPSILON) return { months: 0, interest: 0, firstPayment: 0, completed: true };
  for (let i = 0; i < MAX_MONTHS && balance > EPSILON; i++) {
    const period = Math.min(1, termMonths - i);
    if (period <= 0) break;
    const accrued = periodInterest(balance, rate, period);
    const due = balance + accrued;
    const regular = Math.min(due, payment);
    if (regular <= accrued + 0.000001) {
      return { months, interest, firstPayment: payment, completed: false };
    }
    interest += accrued;
    balance = Math.max(0, due - regular);
    const extra = extraMonthly + (i === 0 ? lump : 0);
    balance = Math.max(0, balance - Math.min(balance, extra));
    months++;
  }
  return { months, interest, firstPayment: payment, completed: balance <= EPSILON };
}

/**
 * Keeps the inferred original term. Recalculates the mandatory payment after
 * each regular and extra payment. The final fractional period is accrued using
 * the same fractional-period convention as the baseline.
 */
export function simulateReducedPayment(
  balanceStart: number,
  annualRate: number,
  termMonths: number,
  initialPayment: number,
  extraMonthly = 0,
  lump = 0,
): RepaymentPlan {
  validateSimulationInputs(balanceStart, annualRate, initialPayment, extraMonthly, lump);
  let balance = balanceStart, interest = 0, months = 0;
  let scheduledPayment = initialPayment, firstPayment = 0;
  const rate = annualRate / 1200;
  if (balance <= EPSILON) return { months: 0, interest: 0, firstPayment: 0, completed: true };

  for (let i = 0; i < MAX_MONTHS && balance > EPSILON; i++) {
    const period = Math.min(1, termMonths - i);
    if (period <= 0) break;
    const accrued = periodInterest(balance, rate, period);
    const due = balance + accrued;
    const regular = Math.min(due, scheduledPayment);
    if (regular <= accrued + 0.000001) {
      return { months, interest, firstPayment, completed: false };
    }
    interest += accrued;
    balance = Math.max(0, due - regular);
    const extra = extraMonthly + (i === 0 ? lump : 0);
    balance = Math.max(0, balance - Math.min(balance, extra));
    months++;
    if (balance <= EPSILON) break;

    const remainingTerm = termMonths - months;
    scheduledPayment = remainingTerm > 0 ? annuityPayment(balance, rate, remainingTerm) : 0;
    if (months === 1) firstPayment = scheduledPayment;
  }
  return { months, interest, firstPayment, completed: balance <= EPSILON };
}
