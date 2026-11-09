"use client";

import { useLayoutEffect, useMemo, useRef, useState, useId } from "react";
import { HandCoins, Wallet, BadgeCheck, X } from "lucide-react";
import { focusNextCalculatorInput } from "@/lib/calculator-input";
import { formatInput } from "@/lib/calculator";
import { scrollFocusedInputIntoView } from "@/lib/scroll-focused-input";

const money = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(Number.isFinite(value) ? value : 0)) + " ₽";
const num = (value: string) => Math.max(0, Number(value.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".")) || 0);
function parseTermMonths(value: string) {
  const clean = value.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  if (!clean) return null;
  const match = clean.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const years = Number(match[1]), months = match[2] ? Number(match[2]) : 0;
  if (months > 11) return null;
  return years * 12 + months;
}
function Field({ label, value, onChange, suffix = "₽", hint, error, allowDecimal = false, maxIntegerDigits = 9, maxDecimalDigits = 0, maxValue, validateValue }: { label: string; value: string; onChange: (value: string) => void; suffix?: string; hint?: string; error?: string; allowDecimal?: boolean; maxIntegerDigits?: number; maxDecimalDigits?: number; maxValue?: number; validateValue?: (value: string) => boolean }) {
  const id = useId();
  const errorId = useId();
  const input = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (cursor.current !== null) {
      input.current?.setSelectionRange(cursor.current, cursor.current);
      cursor.current = null;
    }
  });
  const decimal = allowDecimal;
  return <div className="min-w-0">
    <label htmlFor={id} className="mb-3 block text-sm font-semibold text-[#596779] dark:text-[#D5DEE8]">{label}</label>
    <div className="relative">
      <input ref={input} id={id} name={`sd-calc-${id}`} type="text" inputMode="decimal" autoCorrect="off" autoCapitalize="off" spellCheck={false} autoComplete="off" enterKeyHint="next" placeholder="0"
        value={formatInput(value)}
        onFocus={event => scrollFocusedInputIntoView(event.currentTarget)}
        onClick={event => scrollFocusedInputIntoView(event.currentTarget)}
        onKeyDown={event => {
          if (event.key === "-" || event.key === "−" || event.key === "Subtract") event.preventDefault();
          if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); focusNextCalculatorInput(event.currentTarget); }
        }}
        onChange={event => {
          let raw = event.target.value.replace(/[^\d.,]/g, "").replace(/([.,].*)[.,]/g, "$1");
          const separatorIndex = raw.search(/[.,]/);
          let integerPart = (separatorIndex < 0 ? raw : raw.slice(0, separatorIndex)).slice(0, maxIntegerDigits);
          let fractionPart = separatorIndex < 0 || !decimal ? "" : raw.slice(separatorIndex + 1).replace(/[.,]/g, "").slice(0, maxDecimalDigits);
          let normalized = decimal && separatorIndex >= 0 ? `${integerPart}.${fractionPart}` : integerPart;
          if (maxValue !== undefined && Number(normalized) > maxValue) return;
          if (validateValue && !validateValue(normalized)) return;
          const position = event.target.selectionStart ?? raw.length;
          const significant = raw.slice(0, position).replace(/[\s\u00a0\u202f]/g, "").length;
          const next = formatInput(normalized);
          let index = 0, count = 0;
          while (index < next.length && count < significant) { if (!/[\s\u00a0\u202f]/.test(next[index])) count++; index++; }
          cursor.current = index;
          onChange(normalized);
        }}
        className="h-14 w-full rounded-xl border border-[#E4E8ED] bg-[#F7F8FA] px-4 pr-20 text-lg font-medium tabular-nums text-[#26364A] outline-none transition placeholder:text-sm placeholder:font-normal placeholder:text-[#8993A2] focus:border-[#E83C35] focus:ring-4 focus:ring-[#E83C35]/10 dark:border-[#405064] dark:bg-[#111820] dark:text-[#E6ECF3]"
      />
      {value !== "" && <button type="button" tabIndex={-1} aria-label={`Очистить поле: ${label}`} title="Очистить" onMouseDown={event => event.preventDefault()} onClick={() => { onChange(""); input.current?.focus(); }} className="absolute right-10 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[#8993A2] hover:bg-black/5 hover:text-[#26364A] dark:hover:bg-white/10 dark:hover:text-white"><X className="size-4" /></button>}
      <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#8993A2] dark:text-[#B8C5D3]">{suffix}</span>
    </div>
    {error ? <span id={errorId} role="alert" className="mt-1 block text-xs font-medium text-red-600 dark:text-red-400">{error}</span> : hint && <span className="mt-1 block text-xs text-[#8993A2] dark:text-[#B8C5D3]">{hint}</span>}
  </div>;
}
type Plan = { months: number; interest: number; firstPayment: number; completed: boolean };
const MAX_MONTHS = 600;
function annuity(balance: number, monthlyRate: number, months: number) {
  if (months <= 0 || balance <= 0) return 0;
  if (monthlyRate === 0) return balance / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return balance * monthlyRate * factor / (factor - 1);
}
function simulateFixedPayment(balanceStart: number, rateYear: number, payment: number, extraMonthly: number, lump: number): Plan {
  let balance = balanceStart;
  let interest = 0;
  let months = 0;
  const monthlyRate = rateYear / 1200;
  const firstPayment = payment;
  if (balance <= 0.01) return { months: 0, interest: 0, firstPayment: 0, completed: true };
  for (let i = 0; i < MAX_MONTHS && balance > 0.01; i++) {
    const monthInterest = balance * monthlyRate;
    const due = balance + monthInterest;
    const regularPaid = Math.min(due, payment);
    interest += monthInterest;
    balance = Math.max(0, due - regularPaid);
    const prepayment = extraMonthly + (i === 0 ? lump : 0);
    balance = Math.max(0, balance - Math.min(balance, prepayment));
    months++;
  }
  return { months, interest, firstPayment, completed: balance <= 0.01 };
}
function simulateReducedPayment(balanceStart: number, rateYear: number, termMonths: number, initialPayment: number, extraMonthly: number, lump: number): Plan {
  let balance = balanceStart;
  let interest = 0;
  let months = 0;
  let scheduledPayment = initialPayment;
  let nextPayment = initialPayment;
  let firstPaymentAfterPrepayment = 0;
  const monthlyRate = rateYear / 1200;
  if (balance <= 0.01) return { months: 0, interest: 0, firstPayment: 0, completed: true };
  for (let i = 0; i < termMonths && balance > 0.01; i++) {
    const monthInterest = balance * monthlyRate;
    const due = balance + monthInterest;
    const regularPaid = Math.min(due, scheduledPayment);
    interest += monthInterest;
    balance = Math.max(0, due - regularPaid);
    const prepayment = extraMonthly + (i === 0 ? lump : 0);
    balance = Math.max(0, balance - Math.min(balance, prepayment));
    months++;
    if (balance <= 0.01) {
      nextPayment = 0;
      break;
    }
    const remainingMonths = termMonths - months;
    nextPayment = remainingMonths > 0 ? annuity(balance, monthlyRate, remainingMonths) : 0;
    if (months === 1) firstPaymentAfterPrepayment = nextPayment;
    scheduledPayment = nextPayment;
  }
  return { months, interest, firstPayment: firstPaymentAfterPrepayment, completed: balance <= 0.01 };
}
function duration(months: number) {
  const years = Math.floor(months / 12), rest = months % 12;
  if (years && rest) return `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"} ${rest} мес.`;
  if (years) return `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"}`;
  return `${months} мес.`;
}
export function RealtorMortgageAssistant() {
  const [rate, setRate] = useState("6");
  const [remainingYears, setRemainingYears] = useState("");
  const [balance, setBalance] = useState("4500000");
  const [payment, setPayment] = useState("42000");
  const [extraMonthly, setExtraMonthly] = useState("");
  const [lump, setLump] = useState("");
  const parsedTermMonths = parseTermMonths(remainingYears);
  const errors = {
    balance: num(balance) > 999999999 ? "Максимальная сумма - 999 999 999 ₽." : "",
    payment: num(payment) > 999999999 ? "Максимальная сумма - 999 999 999 ₽." : "",
    extraMonthly: num(extraMonthly) > 999999999 ? "Максимальная сумма - 999 999 999 ₽." : "",
    lump: num(lump) > 999999999 ? "Максимальная сумма - 999 999 999 ₽." : "",
    rate: num(rate) > 30 ? "Максимальная ставка - 30%." : "",
    term: remainingYears !== "" && (parsedTermMonths === null || parsedTermMonths < 1 || parsedTermMonths > MAX_MONTHS) ? "Укажите срок в формате годы.месяцы, например 12.5. Месяцы - от 0 до 11." : "",
  };
  const principal = num(balance);
  const monthlyRate = num(rate) / 1200;
  if (!errors.payment && principal > 0 && num(payment) <= principal * monthlyRate) {
    errors.payment = "Платёж должен быть больше ежемесячно начисляемых процентов.";
  }
  if (!errors.lump && num(lump) > principal && principal > 0) {
    errors.lump = "Разовый взнос не может превышать остаток долга.";
  }
  const isValid = !Object.values(errors).some(Boolean) && principal > 0 && num(payment) > 0;
  const plans = useMemo(() => {
    if (!isValid) return null;
    const regularPayment = num(payment);
    const extra = num(extraMonthly);
    const oneTime = num(lump);
    const base = simulateFixedPayment(principal, num(rate), regularPayment, 0, 0);
    const term = simulateFixedPayment(principal, num(rate), regularPayment, extra, oneTime);
    const termMonths = parsedTermMonths;
    const termTolerance = Math.max(3, Math.round(base.months * 0.05));
    // The entered schedule term is only usable when the current payment can actually amortize
    // the entered balance at the entered rate within that term. Never compare unlike horizons.
    const termMismatch = termMonths !== null && (
      !base.completed || Math.abs(termMonths - base.months) > termTolerance
    );
    const paymentPlan = termMonths !== null && termMonths > 0 && termMonths <= MAX_MONTHS && base.completed && !termMismatch
      ? simulateReducedPayment(principal, num(rate), termMonths, regularPayment, extra, oneTime)
      : null;
    const hasExtra = extra > 0 || oneTime > 0;
    return {
      base,
      term,
      paymentPlan,
      termMonths,
      termMismatch,
      estimatedTermMonths: base.months,
      hasExtra,
      termSaving: base.completed && term.completed ? Math.max(0, base.interest - term.interest) : null,
      paymentSaving: base.completed && paymentPlan?.completed ? Math.max(0, base.interest - paymentPlan.interest) : null,
      monthsSaved: base.completed && term.completed ? Math.max(0, base.months - term.months) : null,
    };
  }, [balance, rate, payment, remainingYears, extraMonthly, lump, isValid, parsedTermMonths]);
  const termScenarioHasHigherSavings = plans?.termSaving !== null && plans?.termSaving !== undefined &&
    (plans.paymentSaving === null || plans.paymentSaving === undefined || plans.termSaving >= plans.paymentSaving);
  return <section className="space-y-5">
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#E2E7ED] bg-white p-4 dark:border-[#354354] dark:bg-[#1B2632]">
        <div className="flex items-start gap-2"><HandCoins className="mt-0.5 size-5 shrink-0 text-[#E83C35] dark:text-[#FF7770]" /><div><h2 className="font-semibold">Досрочное погашение</h2><p className="mt-1 text-sm text-[#748195] dark:text-[#B8C5D3]">Сравните, как досрочные взносы повлияют на срок кредита и размер ежемесячного платежа</p></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Остаток основного долга" value={balance} onChange={setBalance} error={errors.balance} />
          <Field label="Текущий ежемесячный платёж" value={payment} onChange={setPayment} error={errors.payment} />
          <Field label="Процентная ставка" value={rate} onChange={setRate} suffix="%" allowDecimal maxIntegerDigits={2} maxDecimalDigits={2} maxValue={30} error={errors.rate} />
          <Field label="Оставшийся срок по графику" value={remainingYears} onChange={setRemainingYears} suffix="лет" allowDecimal maxIntegerDigits={2} maxDecimalDigits={2} validateValue={value => { const [years, months = ""] = value.split("."); return Number(years || 0) <= 50 && Number(months || 0) <= 11; }} hint={!remainingYears ? "Укажите срок для расчёта по снижению платежа" : undefined} error={errors.term} />
          <Field label="Ежемесячный досрочный платёж" value={extraMonthly} onChange={setExtraMonthly} error={errors.extraMonthly} />
          <Field label="Разовый досрочный платёж" value={lump} onChange={setLump} error={errors.lump} />
        </div>
      </div>
      <div className="rounded-2xl border border-[#E2E7ED] bg-white p-4 dark:border-[#354354] dark:bg-[#1B2632]">
        <div className="flex items-center gap-2"><BadgeCheck className="size-5 text-[#E83C35] dark:text-[#FF7770]" /><h3 className="font-semibold">Два варианта для клиента</h3></div>
        {!isValid ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">Проверьте отмеченные поля, чтобы выполнить расчёт.</p> : plans?.hasExtra ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="flex h-full flex-col rounded-2xl border border-[#F1DCD9] bg-[#FFF7F6] p-4 dark:border-[#65413F] dark:bg-[#302629]">
            
            <div className={`mt-1 text-lg font-bold ${termScenarioHasHigherSavings ? "text-[#C93630] dark:text-[#FF7770]" : "text-[#26364A] dark:text-[#F1F5F9]"}`}>Сокращение срока</div>
            <div className="mt-3"><div className="text-xs text-[#647184] dark:text-[#C5D0DC]">Экономия на процентах</div><div className="mt-1 text-xl font-bold leading-7 text-[#26364A] dark:text-[#F1F5F9]">{plans.termSaving === null ? "Не удалось рассчитать" : money(plans.termSaving)}</div></div>
            <div className="mt-3"><div className="text-xs text-[#647184] dark:text-[#C5D0DC]">Срок сокращён на</div><div className="mt-1 text-base font-semibold leading-6 text-[#26364A] dark:text-[#F1F5F9]">{plans.monthsSaved === null ? "Не удалось определить" : duration(plans.monthsSaved)}</div></div>
            <p className="mt-auto pt-3 text-sm leading-5 text-[#596779] dark:text-[#B8C5D3]"><span className="block">Текущий платёж {money(num(payment))} сохраняется.</span><span className="block">Дополнительные суммы вносятся сверх него.</span></p>
          </div>
          <div className="flex h-full flex-col rounded-2xl border border-[#D6E2F0] bg-[#F5F9FE] p-4 dark:border-[#405A75] dark:bg-[#202F40]">
            
            <div className={`mt-1 text-lg font-bold ${!termScenarioHasHigherSavings && plans.paymentSaving !== null ? "text-[#C93630] dark:text-[#FF7770]" : "text-[#26364A] dark:text-[#F1F5F9]"}`}>Уменьшение платежа</div>
            {plans.paymentPlan && plans.paymentSaving !== null ? <>
              <div className="mt-3"><div className="text-xs text-[#748195] dark:text-[#B8C5D3]">Экономия на процентах</div><div className="mt-1 text-xl font-bold leading-7 text-[#26364A] dark:text-[#F1F5F9]">{money(plans.paymentSaving)}</div></div>
              <div className="mt-3"><div className="text-xs text-[#647184] dark:text-[#C5D0DC]">Новый обязательный платёж</div><div className="mt-1 text-base font-semibold leading-6 text-[#26364A] dark:text-[#E6ECF3]">{money(plans.paymentPlan.firstPayment)}</div></div>
              <p className="mt-auto pt-3 text-sm leading-5 text-[#596779] dark:text-[#B8C5D3]"><span className="block">Срок по графику: {duration(plans.termMonths!)}.</span><span className="block">Ежемесячная досрочная сумма вносится сверх нового обязательного платежа.</span></p>
            </> : <div className="mt-4 flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl px-4 py-5 text-center">
              <Wallet className="size-6 text-[#E83C35] dark:text-[#FF7770]" />
              <p className="max-w-xs text-sm font-semibold leading-relaxed text-[#405A75] dark:text-[#D6E0EA]">{plans.termMismatch ? "Срок по графику не совпадает с расчётным. Проверьте остаток долга, ставку, платёж и срок по графику." : "Заполните оставшийся срок по графику"}</p>
              {plans.termMismatch && <p className="max-w-xs text-xs leading-5 text-[#596779] dark:text-[#B8C5D3]">При остатке долга, ставке и текущем платеже {money(num(payment))} модельный срок составляет {duration(plans.estimatedTermMonths)}. Указанный срок не согласуется с этими данными. Проверьте срок и параметры кредита: расчёт уменьшения платежа остановлен, чтобы не сравнивать разные периоды.</p>}
            </div>}
          </div>
          <div className="rounded-xl border border-[#E2E7ED] bg-[#F7F8FA] p-3 text-sm text-[#536273] dark:border-[#405064] dark:bg-[#17212C] dark:text-[#C5D0DC] sm:col-span-2">
            <div className="flex items-center gap-2 font-semibold text-[#26364A] dark:text-[#E6ECF3]"><Wallet className="size-4 shrink-0 text-[#E83C35] dark:text-[#FF7770]" />Зачем указывать оставшийся срок кредита?</div>
            <p className="mt-2">При уменьшении платежа его размер пересчитывается на оставшийся срок кредита. Поэтому без срока нельзя определить новый платёж и корректно сравнить экономию на процентах.</p>
          </div>
          <p className="text-xs text-[#748195] dark:text-[#B8C5D3] sm:col-span-2">Модель последовательно рассчитывает каждый месяц: начисляет проценты на текущий остаток, учитывает обязательный платёж и затем досрочные взносы. В сценарии уменьшения платежа обязательный платёж пересчитывается на оставшийся срок, а ежемесячная доплата сохраняется сверх него.</p>
        </div> : <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-xl bg-[#EAF2FB]/65 px-4 py-5 text-center text-sm leading-relaxed text-[#536A84] dark:border dark:border-[#405064] dark:bg-[#263648] dark:text-[#D6E0EA]"><HandCoins className="size-6 shrink-0 text-[#E83C35] dark:text-[#FF7770]" /><p className="max-w-sm">Укажите разовый или ежемесячный досрочный взнос, чтобы сравнить два варианта</p></div>}
      </div>
      {isValid && plans?.hasExtra && <details className="group rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] p-3 shadow-sm dark:border-[#405064] dark:bg-[#1B2632]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl bg-[#EEF2F6] px-4 py-3 text-[#26364A] transition-colors hover:bg-[#E8EDF3] dark:bg-[#263443] dark:text-[#E6ECF3] dark:hover:bg-[#2D3D4E]">
          <span>
            <span className="block font-semibold">Подробности расчёта</span>
            <span className="mt-0.5 block text-xs font-normal text-[#748195] dark:text-[#B8C5D3]">Методика и этапы расчёта</span>
          </span>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-lg text-[#596779] shadow-sm transition-transform group-open:rotate-180 dark:bg-[#17212C] dark:text-[#D5DEE8]" aria-hidden="true">⌄</span>
        </summary>
        <div className="px-1 pb-1 pt-4 text-sm leading-relaxed text-[#536273] dark:text-[#B8C5D3]">
          <p>Расчёт выполняется методом помесячного моделирования кредитного обязательства с учётом начисления процентов, обязательных платежей и досрочных взносов.</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 marker:font-semibold marker:text-[#748195] dark:marker:text-[#B8C5D3]">
            <li>Рассчитывается базовый график погашения без досрочных взносов.</li>
            <li>Определяется сумма процентов, начисляемых за каждый расчётный месяц.</li>
            <li>Учитывается погашение основного долга обязательным платежом и досрочными взносами.</li>
            <li>Моделируется изменение остатка задолженности и пересчитываются параметры платежей в зависимости от выбранного сценария.</li>
            <li>Определяются срок полного погашения и общая сумма уплаченных процентов.</li>
            <li>Результаты сравниваются с базовым графиком для определения экономии.</li>
          </ol>
          <div className="mt-4 rounded-xl p-3">
            <div className="font-semibold text-[#26364A] dark:text-[#E6ECF3]">Зачем указывать оставшийся срок кредита?</div>
            <p className="mt-2">При уменьшении платежа его размер пересчитывается на оставшийся срок кредита. Поэтому без срока нельзя определить новый платёж и корректно сравнить экономию на процентах.</p>
          </div>
        </div>
      </details>}
    </div>
    <div className="flex items-start gap-2 rounded-xl bg-[#F3F5F8] p-3 text-xs text-[#748195] dark:bg-[#111820] dark:text-[#B8C5D3]"><Wallet className="mt-0.5 size-4 shrink-0 text-[#E83C35] dark:text-[#FF7770]" />Расчёт предварительный. Фактическая экономия зависит от даты досрочного погашения и условий банка.</div>
  </section>;
}
