export type LoanResult = { principal: number; months: number; annualRate: number; monthlyPayment: number; totalPayment: number; interest: number };

function validateTermAndRate(months: number, annualRate: number) {
  if (Number.isFinite(months) && months > 360) throw new Error("Срок кредита должен составлять не более 30 лет");
  if (!Number.isSafeInteger(months) || months <= 0) throw new Error("Срок должен составлять целое положительное число месяцев.");
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 30) throw new Error("Проверьте ставку.");
}

export function calculateLoan(principal: number, months: number, annualRate: number): LoanResult {
  if (!Number.isFinite(principal) || principal <= 0 || principal > 999999999) throw new Error("Введите корректную сумму. Максимум — 999 999 999 ₽.");
  if (principal < 0.01) throw new Error("Сумма кредита должна быть не меньше 0,01 ₽.");
  if (Math.round(principal * 100) / 100 !== principal) throw new Error("Укажите сумму кредита с точностью до копеек.");
  validateTermAndRate(months, annualRate);
  const monthlyRate = annualRate / 12 / 100;
  // Equivalent to S × i × (1+i)^n / ((1+i)^n − 1), stable for small rates.
  const payment = monthlyRate === 0 ? principal / months : principal * monthlyRate / -Math.expm1(-months * Math.log1p(monthlyRate));
  const totalCents = Math.round(payment * months * 100);
  if (!Number.isSafeInteger(totalCents) || !Number.isFinite(payment) || payment <= 0) throw new Error("Для этих параметров сумма выходит за пределы точного расчёта. Уточните сумму и срок.");
  const totalPayment = totalCents / 100;
  return { principal, months, annualRate, monthlyPayment: payment, totalPayment, interest: Math.max(0, Math.round((totalPayment - principal) * 100) / 100) };
}

export function calculateLoanFromPayment(payment: number, months: number, annualRate: number): LoanResult {
  if (!Number.isFinite(payment) || payment <= 0 || payment > 999999999) throw new Error("Введите корректную сумму. Максимум — 999 999 999 ₽.");
  if (payment < 0.01) throw new Error("Ежемесячный платёж должен быть не меньше 0,01 ₽.");
  if (Math.round(payment * 100) / 100 !== payment) throw new Error("Укажите ежемесячный платёж с точностью до копеек.");
  validateTermAndRate(months, annualRate);
  const monthlyRate = annualRate / 12 / 100;
  const principal = monthlyRate === 0 ? payment * months : payment * (-Math.expm1(-months * Math.log1p(monthlyRate)) / monthlyRate);
  // Round the available principal down so that its payment stays within the budget.
  const cents = monthlyRate === 0 ? Math.round(payment * 100) * months : Math.floor(principal * 100);
  if (!Number.isSafeInteger(cents)) throw new Error("Для этих параметров сумма выходит за пределы точного расчёта. Уточните платёж и срок.");
  if (cents < 1) throw new Error("При этих параметрах сумма кредита меньше 0,01 ₽. Увеличьте платёж или измените срок и ставку.");
  if (cents / 100 > 999999999) throw new Error("При таком платеже сумма кредита превышает 999 999 999 ₽. Уменьшите платёж, срок или ставку.");
  return calculateLoan(cents / 100, months, annualRate);
}
