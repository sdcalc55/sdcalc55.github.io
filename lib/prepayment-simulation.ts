export type RepaymentPlan = { months: number; interest: number; firstPayment: number; completed: boolean };
const MAX_MONTHS = 600;
const EPSILON = 0.005;

export function annuityPayment(balance: number, monthlyRate: number, months: number): number {
  if (balance <= 0 || months <= 0) return 0;
  if (monthlyRate === 0) return balance / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return balance * monthlyRate * factor / (factor - 1);
}

/**
 * Infers the mathematical remaining term from the current balance and scheduled
 * payment. A fractional final month is retained instead of rounding the term up.
 */
export function inferRemainingTerm(balance: number, annualRate: number, payment: number): number {
  const rate = annualRate / 1200;
  if (balance <= 0 || payment <= 0 || payment <= balance * rate) {
    throw new Error("Платёж должен быть больше начисляемых процентов.");
  }
  if (rate === 0) return balance / payment;
  return -Math.log(1 - (balance * rate) / payment) / Math.log(1 + rate);
}

export function simulateFixedPayment(
  balanceStart: number,
  annualRate: number,
  payment: number,
  extraMonthly = 0,
  lump = 0,
): RepaymentPlan {
  let balance = balanceStart, interest = 0, months = 0;
  const rate = annualRate / 1200;
  if (balance <= EPSILON) return { months: 0, interest: 0, firstPayment: 0, completed: true };
  for (let i = 0; i < MAX_MONTHS && balance > EPSILON; i++) {
    const monthInterest = balance * rate;
    const due = balance + monthInterest;
    const regular = Math.min(due, payment);
    if (regular <= monthInterest + 0.000001) {
      return { months, interest, firstPayment: payment, completed: false };
    }
    interest += monthInterest;
    balance = Math.max(0, due - regular);
    const extra = extraMonthly + (i === 0 ? lump : 0);
    balance = Math.max(0, balance - Math.min(balance, extra));
    months++;
  }
  return { months, interest, firstPayment: payment, completed: balance <= EPSILON };
}

/**
 * Keeps the inferred original term. After each regular payment and extra payment,
 * recalculates the required payment over the exact remaining fractional term.
 * The final installment is limited to the actual outstanding balance plus interest.
 */
export function simulateReducedPayment(
  balanceStart: number,
  annualRate: number,
  termMonths: number,
  initialPayment: number,
  extraMonthly = 0,
  lump = 0,
): RepaymentPlan {
  let balance = balanceStart, interest = 0, months = 0;
  let scheduledPayment = initialPayment, firstPayment = 0;
  const rate = annualRate / 1200;
  if (balance <= EPSILON) return { months: 0, interest: 0, firstPayment: 0, completed: true };

  for (let i = 0; i < MAX_MONTHS && balance > EPSILON; i++) {
    const monthInterest = balance * rate;
    const due = balance + monthInterest;
    const regular = Math.min(due, scheduledPayment);
    if (regular <= monthInterest + 0.000001) {
      return { months, interest, firstPayment, completed: false };
    }
    interest += monthInterest;
    balance = Math.max(0, due - regular);
    const extra = extraMonthly + (i === 0 ? lump : 0);
    balance = Math.max(0, balance - Math.min(balance, extra));
    months++;
    if (balance <= EPSILON) break;

    const remainingTerm = termMonths - months;
    if (remainingTerm <= 0) {
      scheduledPayment = balance * (1 + rate);
    } else if (remainingTerm <= 1) {
      scheduledPayment = balance * (1 + rate);
    } else {
      scheduledPayment = annuityPayment(balance, rate, remainingTerm);
    }
    if (months === 1) firstPayment = scheduledPayment;
  }
  return { months, interest, firstPayment, completed: balance <= EPSILON };
}
