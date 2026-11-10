"use client";

import { useLayoutEffect, useMemo, useRef, useState, useId } from "react";
import { HandCoins, Wallet, X, RotateCcw } from "lucide-react";
import { focusNextCalculatorInput, handleFormattedBackspace, handleFormattedDelete } from "@/lib/calculator-input";
import { formatInput } from "@/lib/calculator";
import { normalizeNumericInput } from "@/lib/numeric-input";
import { scrollFocusedInputIntoView } from "@/lib/scroll-focused-input";
import { inferRemainingTerm, simulateFixedPayment, simulateReducedPayment } from "@/lib/prepayment-simulation";

const money = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(Number.isFinite(value) ? value : 0)) + " ₽";
const num = (value: string) => Math.max(0, Number(value.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".")) || 0);
function Field({ label, value, onChange, suffix = "₽", hint, error, allowDecimal = false, maxIntegerDigits = 9, maxDecimalDigits = 0, maxValue, validateValue, className = "" }: { label: string; value: string; onChange: (value: string) => void; suffix?: string; hint?: string; error?: string; allowDecimal?: boolean; maxIntegerDigits?: number; maxDecimalDigits?: number; maxValue?: number; validateValue?: (value: string) => boolean; className?: string }) {
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
  return <div className={`min-w-0 ${className}`}>
    <label htmlFor={id} className="mb-3 block text-sm font-semibold text-[#596779] dark:text-[#D5DEE8]">{label}</label>
    <div className="relative">
      <input ref={input} id={id} name={`sd-calc-${id}`} type="text" inputMode="decimal" autoCorrect="off" autoCapitalize="off" spellCheck={false} autoComplete="off" enterKeyHint="next" placeholder="0"
        value={formatInput(value)}
        onFocus={event => scrollFocusedInputIntoView(event.currentTarget)}
        onClick={event => scrollFocusedInputIntoView(event.currentTarget)}
        onKeyDown={event => {
          if (handleFormattedBackspace(event, onChange, false) || handleFormattedDelete(event, onChange, false)) return;
          if (event.key === "-" || event.key === "−" || event.key === "Subtract") event.preventDefault();
          if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); focusNextCalculatorInput(event.currentTarget); }
        }}
        onPaste={event => {
          const pasted = event.clipboardData.getData("text");
          if (normalizeNumericInput(pasted, { maxIntegerDigits, maxFractionDigits: decimal ? maxDecimalDigits : 0, maxValue }) === null) {
            event.preventDefault();
          }
        }}
        onChange={event => {
          const normalized = normalizeNumericInput(event.target.value, {
            maxIntegerDigits,
            maxFractionDigits: decimal ? maxDecimalDigits : 0,
            maxValue,
            strictGrouping: false,
          });
          if (normalized === null) return;
          if (validateValue && !validateValue(normalized)) return;
          const raw = normalized;
          const position = event.target.selectionStart ?? raw.length;
          const significant = event.target.value.slice(0, position).replace(/[^\d.,]/g, "").length;
          const next = formatInput(normalized);
          let index = 0, count = 0;
          while (index < next.length && count < significant) {
            if (!/[\s\u00a0\u202f]/.test(next[index])) count++;
            index++;
          }
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
function duration(months: number) {
  const years = Math.floor(months / 12), rest = months % 12;
  if (years && rest) return `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"} ${rest} мес.`;
  if (years) return `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"}`;
  return `${months} мес.`;
}
export function RealtorMortgageAssistant() {
  const [rate, setRate] = useState("6");
  const [balance, setBalance] = useState("4500000");
  const [payment, setPayment] = useState("42000");
  const [extraMonthly, setExtraMonthly] = useState("");
  const [lump, setLump] = useState("");
  const errors = {
    balance: num(balance) > 999999999 ? "Максимальная сумма - 999 999 999 ₽." : "",
    payment: num(payment) > 999999999 ? "Максимальная сумма - 999 999 999 ₽." : "",
    extraMonthly: num(extraMonthly) > 999999999 ? "Максимальная сумма - 999 999 999 ₽." : num(extraMonthly) > num(balance) && num(extraMonthly) > 0 ? "Ежемесячный досрочный платёж не может превышать остаток долга." : "",
    lump: num(lump) > 999999999 ? "Максимальная сумма - 999 999 999 ₽." : "",
    rate: num(rate) > 30 ? "Максимальная ставка - 30%." : "",
  };
  const principal = num(balance);
  const monthlyRate = num(rate) / 1200;
  if (!errors.payment && principal > 0 && num(payment) <= principal * monthlyRate) {
    errors.payment = "Платёж должен быть больше ежемесячно начисляемых процентов.";
  }
  if (!errors.lump && num(lump) > principal && principal > 0) {
    errors.lump = "Разовый взнос не может превышать остаток долга.";
  }
  if (!errors.payment && principal > 0 && num(payment) > 0) {
    try {
      inferRemainingTerm(principal, num(rate), num(payment));
    } catch (error) {
      errors.payment = error instanceof Error ? error.message : "Проверьте параметры кредита.";
    }
  }
  const isValid = !Object.values(errors).some(Boolean) && principal > 0 && num(payment) > 0;
  const plans = useMemo(() => {
    if (!isValid) return null;
    const regularPayment = num(payment);
    const extra = num(extraMonthly);
    const oneTime = num(lump);
    const inferredTerm = inferRemainingTerm(principal, num(rate), regularPayment);
    const base = simulateFixedPayment(principal, num(rate), regularPayment, 0, 0, inferredTerm);
    const term = simulateFixedPayment(principal, num(rate), regularPayment, extra, oneTime, inferredTerm);
    const paymentPlan = simulateReducedPayment(principal, num(rate), inferredTerm, regularPayment, extra, oneTime);
    const hasExtra = extra > 0 || oneTime > 0;
    return {
      base,
      term,
      paymentPlan,
      termMonths: base.months,
      estimatedTermMonths: base.months,
      hasExtra,
      termSaving: base.completed && term.completed
        ? (base.interest - term.interest >= -0.01 ? Math.max(0, base.interest - term.interest) : null)
        : null,
      paymentSaving: base.completed && paymentPlan.completed
        ? (base.interest - paymentPlan.interest >= -0.01 ? Math.max(0, base.interest - paymentPlan.interest) : null)
        : null,
      monthsSaved: base.completed && term.completed ? Math.max(0, base.months - term.months) : null,
    };
  }, [balance, principal, rate, payment, extraMonthly, lump, isValid]);
  const termScenarioHasHigherSavings = plans?.termSaving !== null && plans?.termSaving !== undefined &&
    (plans.paymentSaving === null || plans.paymentSaving === undefined || plans.termSaving >= plans.paymentSaving);
  return <section className="space-y-5">
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#E2E7ED] bg-white p-4 dark:border-[#354354] dark:bg-[#1B2632]">
        <div className="flex items-start gap-2"><HandCoins className="mt-0.5 size-5 shrink-0 text-[#E83C35] dark:text-[#FF7770]" /><div><h2 className="font-semibold">Досрочное погашение</h2><p className="mt-1 text-sm text-[#748195] dark:text-[#B8C5D3]">Сравните, как досрочные взносы повлияют на срок кредита и размер ежемесячного платежа</p></div></div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Остаток основного долга" value={balance} onChange={setBalance} error={errors.balance} />
          <Field label="Процентная ставка" value={rate} onChange={setRate} suffix="%" allowDecimal maxIntegerDigits={2} maxDecimalDigits={2} maxValue={30} error={errors.rate} />
          <Field className="md:col-span-2" label="Текущий ежемесячный платёж" value={payment} onChange={setPayment} error={errors.payment} />
          <Field label="Ежемесячный досрочный платёж" value={extraMonthly} onChange={setExtraMonthly} error={errors.extraMonthly} />
          <Field label="Разовый досрочный платёж" value={lump} onChange={setLump} error={errors.lump} />
        </div>
        <div className="mt-5 flex justify-end border-t border-[#EBEEF2] pt-3 dark:border-[#354354]">
          <button type="button" onClick={() => { setBalance("4500000"); setPayment("42000"); setRate("6"); setExtraMonthly(""); setLump(""); }} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#E4E8ED] px-4 py-2 text-sm font-semibold text-[#647184] transition hover:bg-[#F5F7FA] hover:text-[#E83C35] dark:border-[#405064] dark:text-[#D5DEE8] dark:hover:bg-[#253241]"><RotateCcw className="size-4" />СБРОСИТЬ</button>
        </div>
      </div>
      {!isValid ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">Проверьте отмеченные поля, чтобы выполнить расчёт.</p> : plans?.hasExtra ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="flex h-full flex-col rounded-2xl border border-[#F1DCD9] bg-[#FFF7F6] p-4 dark:border-[#65413F] dark:bg-[#302629]">
            
            <div className={`mt-1 text-lg font-bold ${termScenarioHasHigherSavings ? "text-[#C93630] dark:text-[#FF7770]" : "text-[#26364A] dark:text-[#F1F5F9]"}`}>Сокращение срока</div>
            <div className="mt-3"><div className="text-xs text-[#647184] dark:text-[#C5D0DC]">Переплата уменьшится на</div><div data-testid="term-interest-savings" className="mt-1 text-xl font-bold leading-7 text-[#26364A] dark:text-[#F1F5F9]">{plans.termSaving === null ? "Не удалось рассчитать" : money(plans.termSaving)}</div></div>
            <div className="mt-3"><div className="text-xs text-[#647184] dark:text-[#C5D0DC]">Остаток срока после досрочного погашения</div><div data-testid="term-remaining-duration" className="mt-1 text-base font-semibold leading-6 text-[#26364A] dark:text-[#F1F5F9]">{plans.term.completed ? duration(plans.term.months) : "Не удалось определить"}</div><div className="mt-2 text-xs text-[#647184] dark:text-[#C5D0DC]">Срок сокращён на</div><div className="mt-1 text-base font-semibold leading-6 text-[#26364A] dark:text-[#F1F5F9]">{plans.monthsSaved === null ? "Не удалось определить" : duration(plans.monthsSaved)}</div></div>
            <p className="mt-auto pt-3 text-xs leading-5 text-[#748195] dark:text-[#B8C5D3]"><span className="block">Текущий платёж {money(num(payment))} сохраняется.</span><span className="mt-1 block">Досрочные взносы вносятся сверх него.</span></p>
          </div>
          <div className="flex h-full flex-col rounded-2xl border border-[#D6E2F0] bg-[#F5F9FE] p-4 dark:border-[#405A75] dark:bg-[#202F40]">
            
            <div className={`mt-1 text-lg font-bold ${!termScenarioHasHigherSavings && plans.paymentSaving !== null ? "text-[#C93630] dark:text-[#FF7770]" : "text-[#26364A] dark:text-[#F1F5F9]"}`}>Уменьшение платежа</div>
            {plans.paymentPlan?.completed && plans.paymentSaving !== null && plans.paymentPlan.firstPayment > 0 ? <>
              <div data-testid="reduced-payment-display" className="mt-3 bg-transparent">
                <div className="text-xs font-medium text-[#647184] dark:text-[#C5D0DC]">Новый обязательный платёж</div>
                <div className="mt-1 text-2xl font-bold leading-8 tabular-nums text-[#26364A] dark:text-[#F1F5F9]">{money(plans.paymentPlan.firstPayment)}</div>
                <div className="mt-1 text-xs text-[#748195] dark:text-[#B8C5D3]">Вместо {money(num(payment))}</div>
              </div>
              <div className="mt-3"><div className="text-xs text-[#748195] dark:text-[#B8C5D3]">Переплата уменьшится на</div><div className="mt-1 text-lg font-semibold leading-7 text-[#26364A] dark:text-[#F1F5F9]">{money(plans.paymentSaving)}</div></div>
              <p className="mt-auto pt-3 text-xs leading-5 text-[#748195] dark:text-[#B8C5D3]"><span className="lg:block">Остаток срока: {duration(plans.termMonths!)}.</span><span className="lg:block">Досрочные взносы вносятся сверх нового обязательного платежа.</span></p>
            </> : plans.paymentPlan?.completed ? <div className="mt-4 flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl px-4 py-5 text-center">
              <Wallet className="size-6 text-[#E83C35] dark:text-[#FF7770]" />
              <p className="max-w-xs text-sm font-semibold leading-relaxed text-[#405A75] dark:text-[#D6E0EA]">Досрочные взносы полностью погашают кредит в первом расчётном периоде. Новый обязательный платёж не требуется.</p>
            </div> : <div className="mt-4 rounded-xl px-4 py-5 text-sm font-semibold text-[#9A3412] dark:text-[#FDBA74]">Не удалось завершить расчёт в пределах 50 лет. Проверьте сумму платежа.</div>}
          </div>
        </div> : <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-xl bg-[#EAF2FB]/65 px-4 py-5 text-center text-sm leading-relaxed text-[#536A84] dark:border dark:border-[#405064] dark:bg-[#263648] dark:text-[#D6E0EA]"><HandCoins className="size-6 shrink-0 text-[#E83C35] dark:text-[#FF7770]" /><p className="max-w-sm">Укажите разовый или ежемесячный досрочный взнос, чтобы сравнить два варианта</p></div>}
      {isValid && plans?.hasExtra && <>
        <p data-testid="prepayment-disclaimer" className="mt-4 flex items-start gap-2 rounded-xl border border-[#E2E7ED] bg-white/70 p-3 text-xs leading-relaxed text-[#748195] [user-select:none] [-webkit-user-select:none] dark:border-[#405064] dark:bg-[#111820] dark:text-[#B8C5D3]"><Wallet className="mt-0.5 size-4 shrink-0 text-[#E83C35] dark:text-[#FF7770]" /><span>Расчёт предварительный. Фактическая экономия зависит от даты досрочного погашения и условий банка.</span></p>
      <details className="group rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] p-3 shadow-sm dark:border-[#405064] dark:bg-[#1B2632]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-[#26364A] transition-colors dark:text-[#E6ECF3]">
          <span>
            <span className="block font-semibold">Подробности расчёта</span>
            <span className="mt-0.5 block text-xs font-normal text-[#748195] dark:text-[#B8C5D3]">Методика и этапы расчёта</span>
          </span>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-lg text-[#596779] shadow-sm transition-transform group-open:rotate-180 dark:bg-[#17212C] dark:text-[#D5DEE8]" aria-hidden="true">⌄</span>
        </summary>
        <div className="px-1 pb-1 pt-4 text-sm leading-relaxed text-[#536273] dark:text-[#B8C5D3]">
          <p>Расчёт выполняется методом помесячного моделирования кредитного обязательства с учётом начисления процентов, обязательных платежей и досрочных взносов. Поскольку срок кредита отдельно не вводится, расчётный срок определяется по остатку основного долга, процентной ставке и текущему ежемесячному платежу. Проценты начисляются ежемесячно на остаток долга по ставке, равной годовой ставке, делённой на 12 и на 100.</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 marker:font-semibold marker:text-[#748195] dark:marker:text-[#B8C5D3]">
            <li>По введённым данным определяется расчётный срок кредита и строится базовый график без досрочных взносов.</li>
            <li>Для каждого месяца рассчитываются проценты на текущий остаток основного долга.</li>
            <li>Из обязательного платежа сначала погашаются начисленные проценты, оставшаяся часть уменьшает основной долг.</li>
            <li>Досрочные взносы учитываются отдельно от обязательного платежа: ежемесячный взнос добавляется к нему каждый месяц, разовый - в первом расчётном месяце. Сумма досрочного взноса уменьшает остаток долга и не заменяет обязательный платёж.</li>
            <li>В сценарии «Сокращение срока» текущий обязательный платёж сохраняется, а досрочные взносы направляются на уменьшение остатка долга. В сценарии «Уменьшение платежа» после досрочного погашения обязательный платёж пересчитывается на оставшийся расчётный срок.</li>
            <li>Для каждого сценария определяется расчётный месяц полного погашения и сумма процентов. Результаты сравниваются с базовым графиком, а экономия определяется как разница в процентах.</li>
          </ol>
          
        </div>
      </details>
      </>}
    </div>

  </section>;
}
