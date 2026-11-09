export type RepaymentPlan = { months: number; interest: number; totalPaid: number; firstPayment: number; finalPayment: number; completed: boolean };
const MAX_MONTHS = 600;
const EPSILON = 0.005;

function validateSimulationInputs(balance: number, annualRate: number, payment: number, extraMonthly: number, lump: number) {
  if (!Number.isFinite(balance) || balance <= 0 || balance > 999999999) throw new Error("Проверьте остаток основного долга.");
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 30) throw new Error("Процентная ставка должна быть от 0 до 30%.");
  if (!Number.isFinite(payment) || payment <= 0) throw new Error("Ежемесячный платёж должен быть больше нуля.");
  if (!Number.isFinite(extraMonthly) || extraMonthly < 0 || extraMonthly > balance) throw new Error("Ежемесячный досрочный платёж не может превышать остаток долга.");
  if (!Number.isFinite(lump) || lump < 0 || lump > balance) throw new Error("Разовый досрочный платёж не может превышать остаток долга.");
}

export function annuityPayment(balance: number, monthlyRate: number, months: number): number {
  if (balance <= 0 || months <= 0) return 0;
  if (monthlyRate === 0) return balance / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return balance * monthlyRate * factor / (factor - 1);
}

/** Infers a fractional mathematical term from the current balance, rate and payment. */
export function inferRemainingTerm(balance: number, annualRate: number, payment: number): number {
  if (!Number.isFinite(balance) || balance <= 0 || balance > 999999999) throw new Error("Проверьте остаток основного долга.");
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 30) throw new Error("Процентная ставка должна быть от 0 до 30%.");
  if (!Number.isFinite(payment) || payment <= 0) throw new Error("Ежемесячный платёж должен быть больше нуля.");
  const rate = annualRate / 1200;
  if (payment <= balance * rate) throw new Error("Ежемесячный платёж не покрывает проценты по кредиту.");
  const term = rate === 0 ? balance / payment : -Math.log(1 - (balance * rate) / payment) / Math.log(1 + rate);
  if (!Number.isFinite(term) || term <= 0 || term > MAX_MONTHS) throw new Error("Расчётный срок превышает 50 лет. Увеличьте ежемесячный платёж.");
  return term;
}

function periodInterest(balance: number, rate: number, period: number): number {
  return balance * (Math.pow(1 + rate, period) - 1);
}

/** Fixed mandatory payment; extra payments are applied after it in each period. */
export function simulateFixedPayment(
  balanceStart: number,
  annualRate: number,
  payment: number,
  extraMonthly = 0,
  lump = 0,
  termMonths = inferRemainingTerm(balanceStart, annualRate, payment),
): RepaymentPlan {
  validateSimulationInputs(balanceStart, annualRate, payment, extraMonthly, lump);
  let balance = balanceStart, interest = 0, totalPaid = 0, finalPayment = 0, months = 0;
  const rate = annualRate / 1200;
  if (balance <= EPSILON) return { months: 0, interest: 0, totalPaid: 0, firstPayment: 0, finalPayment: 0, completed: true };
  for (let i = 0; i < MAX_MONTHS && balance > EPSILON; i++) {
    const period = Math.min(1, termMonths - i);
    if (period <= 0) break;
    const accrued = periodInterest(balance, rate, period), due = balance + accrued;
    const regular = Math.min(due, payment);
    if (regular <= accrued + 0.000001) break;
    interest += accrued;
    balance = Math.max(0, due - regular);
    const extra = Math.min(balance, extraMonthly + (i === 0 ? lump : 0));
    balance = Math.max(0, balance - extra);
    finalPayment = regular + extra;
    totalPaid += finalPayment;
    months++;
  }
  return { months, interest, totalPaid, firstPayment: payment, finalPayment, completed: balance <= EPSILON };
}

/** Recalculates the mandatory payment after every period while retaining the original fractional term. */
export function simulateReducedPayment(
  balanceStart: number,
  annualRate: number,
  termMonths: number,
  initialPayment: number,
  extraMonthly = 0,
  lump = 0,
): RepaymentPlan {
  validateSimulationInputs(balanceStart, annualRate, initialPayment, extraMonthly, lump);
  let balance = balanceStart, interest = 0, totalPaid = 0, months = 0, finalPayment = 0;
  let scheduledPayment = initialPayment, firstPayment = 0;
  const rate = annualRate / 1200;
  if (balance <= EPSILON) return { months: 0, interest: 0, totalPaid: 0, firstPayment: 0, finalPayment: 0, completed: true };
  for (let i = 0; i < MAX_MONTHS && balance > EPSILON; i++) {
    const period = Math.min(1, termMonths - i);
    if (period <= 0) break;
    const accrued = periodInterest(balance, rate, period), due = balance + accrued;
    const regular = Math.min(due, scheduledPayment);
    if (regular <= accrued + 0.000001) break;
    interest += accrued;
    balance = Math.max(0, due - regular);
    const extra = Math.min(balance, extraMonthly + (i === 0 ? lump : 0));
    balance = Math.max(0, balance - extra);
    finalPayment = regular + extra;
    totalPaid += finalPayment;
    months++;
    if (balance <= EPSILON) break;
    const remainingTerm = termMonths - months;
    scheduledPayment = remainingTerm > 0 ? annuityPayment(balance, rate, remainingTerm) : 0;
    if (months === 1) firstPayment = scheduledPayment;
  }
  return { months, interest, totalPaid, firstPayment, finalPayment, completed: balance <= EPSILON };
}
