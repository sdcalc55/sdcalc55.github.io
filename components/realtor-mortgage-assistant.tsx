"use client";

import { useLayoutEffect, useMemo, useRef, useState, useId } from "react";
import { Calculator, Wallet, BadgeCheck, X } from "lucide-react";
import { focusNextCalculatorInput } from "@/lib/calculator-input";
import { formatInput } from "@/lib/calculator";
import { scrollFocusedInputIntoView } from "@/lib/scroll-focused-input";

const money = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(Number.isFinite(value) ? value : 0)) + " ₽";
const num = (value: string) => Math.max(0, Number(value.replace(/[\\s\\u00a0\\u202f]/g, "").replace(",", ".")) || 0);
function Field({ label, value, onChange, suffix = "₽", step = 10000, hint }: { label: string; value: string; onChange: (value: string) => void; suffix?: string; step?: number; hint?: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (cursor.current !== null) {
      input.current?.setSelectionRange(cursor.current, cursor.current);
      cursor.current = null;
    }
  });
  const decimal = suffix === "%";
  return <div className="min-w-0">
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[#647184] dark:text-[#AAB6C5]">{label}</label>
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
          const raw = event.target.value.replace(/[^\d.,]/g, "").replace(/([.,].*)[.,]/g, "$1");
          const digitsBeforeDecimal = raw.replace(/[\s\u00a0\u202f]/g, "").split(/[.,]/)[0].replace(/^0+/, "");
          if (digitsBeforeDecimal.length > 10) return;
          const position = event.target.selectionStart ?? raw.length;
          const significant = raw.slice(0, position).replace(/[\s\u00a0\u202f]/g, "").length;
          const normalized = decimal ? raw.replace(",", ".") : raw.replace(/[.,].*$/, "");
          const next = formatInput(normalized);
          let index = 0, count = 0;
          while (index < next.length && count < significant) { if (!/[\s\u00a0\u202f]/.test(next[index])) count++; index++; }
          cursor.current = index;
          onChange(normalized);
        }}
        className="h-14 w-full rounded-xl border border-[#DCE2E9] bg-[#F7F8FA] px-3 pr-20 text-base font-semibold tabular-nums text-[#26364A] outline-none transition focus:border-[#E83C35] focus:ring-4 focus:ring-[#E83C35]/10 dark:border-[#405064] dark:bg-[#111820] dark:text-[#E6ECF3]"
      />
      {value !== "" && <button type="button" tabIndex={-1} aria-label={`Очистить поле: ${label}`} title="Очистить" onMouseDown={event => event.preventDefault()} onClick={() => { onChange(""); input.current?.focus(); }} className="absolute right-10 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[#8993A2] hover:bg-black/5 hover:text-[#26364A] dark:hover:bg-white/10 dark:hover:text-white"><X className="size-4" /></button>}
      <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#8993A2]">{suffix}</span>
    </div>
    {hint && <span className="mt-1 block text-xs text-[#8993A2]">{hint}</span>}
  </div>;
}
type Plan = { months: number; interest: number; firstPayment: number };
function annuity(balance: number, monthlyRate: number, months: number) {
  if (months <= 0 || balance <= 0) return 0;
  if (monthlyRate === 0) return balance / months;
  return balance * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
}
function simulate(balanceStart: number, rateYear: number, payment: number, monthsLimit: number, extraMonthly: number, lump: number, strategy: "term" | "payment"): Plan {
  let balance = Math.max(0, balanceStart - lump);
  let interest = 0;
  let months = 0;
  const monthlyRate = rateYear / 1200;
  const firstPayment = strategy === "payment" ? annuity(balance, monthlyRate, monthsLimit) : payment;
  for (let i = 0; i < Math.min(600, monthsLimit || 600) && balance > 0.01; i++) {
    const regular = strategy === "payment" ? annuity(balance, monthlyRate, Math.max(1, monthsLimit - i)) : payment;
    const monthInterest = balance * monthlyRate;
    interest += monthInterest;
    const due = balance + monthInterest;
    const paid = Math.min(due, regular + extraMonthly);
    if (paid <= 0) break;
    balance = Math.max(0, due - paid);
    months++;
  }
  return { months, interest, firstPayment };
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
  const plans = useMemo(() => {
    const principal = num(balance);
    const monthlyRate = num(rate) / 1200;
    const regularPayment = num(payment);
    let estimatedMonths = 600;
    if (principal > 0 && regularPayment > 0) {
      if (monthlyRate === 0) estimatedMonths = Math.ceil(principal / regularPayment);
      else if (regularPayment > principal * monthlyRate) {
        estimatedMonths = Math.ceil(-Math.log(1 - principal * monthlyRate / regularPayment) / Math.log(1 + monthlyRate));
      }
    }
    const monthsLimit = Math.max(1, Math.min(600, Math.round(num(remainingYears) * 12) || estimatedMonths));
    const base = simulate(principal, num(rate), regularPayment, monthsLimit, 0, 0, "term");
    const term = simulate(principal, num(rate), regularPayment, monthsLimit, num(extraMonthly), num(lump), "term");
    const paymentPlan = simulate(principal, num(rate), regularPayment, monthsLimit, num(extraMonthly), num(lump), "payment");
    const hasExtra = num(extraMonthly) > 0 || num(lump) > 0;
    const recommended = term.interest <= paymentPlan.interest ? "term" : "payment";
    const selected = recommended === "term" ? term : paymentPlan;
    return {
      base,
      term,
      paymentPlan,
      recommended,
      selected,
      saving: Math.max(0, base.interest - selected.interest),
      paymentReduction: Math.max(0, regularPayment - paymentPlan.firstPayment),
      monthsSaved: Math.max(0, base.months - selected.months),
      hasExtra,
      estimated: !remainingYears.trim(),
    };
  }, [balance, rate, payment, remainingYears, extraMonthly, lump]);
  return <section className="space-y-5">
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#E2E7ED] bg-white p-4 dark:border-[#354354] dark:bg-[#1B2632]">
        <div className="flex items-start gap-2"><Calculator className="mt-0.5 size-5 shrink-0 text-[#E83C35]" /><div><h2 className="font-semibold">Стратегия погашения</h2><p className="mt-1 text-sm text-[#748195]">Введите параметры действующего кредита и дополнительные суммы для досрочного погашения.</p></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Остаток основного долга" value={balance} onChange={setBalance} />
          <Field label="Текущий ежемесячный платёж" value={payment} onChange={setPayment} />
          <Field label="Процентная ставка" value={rate} onChange={setRate} suffix="%" step={0.1} />
          <Field label="Оставшийся срок по графику (необязательно)" value={remainingYears} onChange={setRemainingYears} suffix="лет" />
          <Field label="Дополнительно каждый месяц" value={extraMonthly} onChange={setExtraMonthly} hint="Необязательно" />
          <Field label="Разовый досрочный взнос" value={lump} onChange={setLump} hint="Необязательно" />
        </div>
      </div>
      <div className="rounded-2xl border border-[#E2E7ED] bg-white p-4 dark:border-[#354354] dark:bg-[#1B2632]">
        <div className="flex items-center gap-2"><BadgeCheck className="size-5 text-[#E83C35]" /><h3 className="font-semibold">Что выгоднее выбрать клиенту</h3></div>
        {plans.hasExtra ? <div className="mt-3 rounded-xl bg-[#FCEBEA] p-3 dark:bg-[#352322]">
          <div className="text-xs font-semibold text-[#9B302B] dark:text-[#F09A94]">Рекомендуемая стратегия</div>
          <div className="mt-1 text-xl font-bold text-[#B8322D] dark:text-[#F09A94]">{plans.recommended === "term" ? "Сокращение срока" : "Уменьшение ежемесячного платежа"}</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div><div className="text-xs text-[#748195]">Экономия на процентах</div><div className="mt-1 text-lg font-bold text-[#26364A] dark:text-[#E6ECF3]">{money(plans.saving)}</div></div>
            <div><div className="text-xs text-[#748195]">Срок погашения</div><div className="mt-1 text-lg font-bold text-[#26364A] dark:text-[#E6ECF3]">{duration(plans.selected.months)}</div></div>
            {plans.recommended === "term" ? <div className="col-span-2"><div className="text-xs text-[#748195]">На сколько раньше закроется ипотека</div><div className="mt-1 font-semibold text-[#26364A] dark:text-[#E6ECF3]">{duration(plans.monthsSaved)}</div></div> : <div className="col-span-2"><div className="text-xs text-[#748195]">Новый ежемесячный платёж после перерасчёта</div><div className="mt-1 font-semibold text-[#26364A] dark:text-[#E6ECF3]">{money(plans.paymentPlan.firstPayment)}</div><div className="mt-1 text-xs text-[#748195]">Снижение относительно текущего платежа: {money(plans.paymentReduction)}</div></div>}
          </div>
        </div> : <p className="mt-3 text-sm text-[#748195]">Укажите разовый или ежемесячный досрочный взнос, чтобы сравнить стратегии.</p>}
      </div>
    </div>
    <div className="flex items-start gap-2 rounded-xl bg-[#F3F5F8] p-3 text-xs text-[#748195] dark:bg-[#111820]"><Wallet className="mt-0.5 size-4 shrink-0" />Расчёт предварительный и может отличаться из-за даты досрочного взноса и правил перерасчёта.</div>
  </section>;
}
