"use client";

import { useMemo, useState } from "react";
import { Calculator, Wallet, BadgeCheck } from "lucide-react";
import { formatInput } from "@/lib/calculator";

const money = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(Number.isFinite(value) ? value : 0)) + " ₽";
const num = (value: string) => Math.max(0, Number(value.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".")) || 0);
function Field({ label, value, onChange, suffix = "₽", step = 10000, hint }: { label: string; value: string; onChange: (value: string) => void; suffix?: string; step?: number; hint?: string }) {
  const decimal = suffix === "%";
  return <label className="block min-w-0"><span className="mb-1.5 block text-sm font-medium text-[#647184] dark:text-[#AAB6C5]">{label}</span><span className="flex items-center rounded-xl border border-[#DCE2E9] bg-white px-3 dark:border-[#405064] dark:bg-[#111820]"><input type="text" inputMode="decimal" value={formatInput(value)} onChange={event => { const raw = event.target.value.replace(/[^\d.,]/g, "").replace(/([.,].*)[.,]/g, "$1"); const normalized = decimal ? raw : raw.replace(/[.,].*$/, ""); onChange(normalized); }} className="min-w-0 w-full bg-transparent py-3 text-base font-semibold tabular-nums text-[#26364A] outline-none dark:text-[#E6ECF3]" /><span className="pl-2 text-sm text-[#8993A2]">{suffix}</span></span>{hint && <span className="mt-1 block text-xs text-[#8993A2]">{hint}</span>}</label>;
}
function Result({ label, value, primary = false, detail }: { label: string; value: string; primary?: boolean; detail?: string }) {
  return <div className={`rounded-xl p-3 ${primary ? "bg-[#FCEBEA] dark:bg-[#352322]" : "bg-[#F3F5F8] dark:bg-[#111820]"}`}><div className="text-xs text-[#748195]">{label}</div><div className={`mt-1 text-lg font-bold tabular-nums ${primary ? "text-[#B8322D] dark:text-[#F09A94]" : "text-[#26364A] dark:text-[#E6ECF3]"}`}>{value}</div>{detail && <div className="mt-1 text-xs text-[#748195]">{detail}</div>}</div>;
}
type Plan = { title: string; months: number; interest: number; paid: number };
function simulate(balanceStart: number, rateYear: number, payment: number, monthsLimit: number, extraMonthly = 0, lump = 0): Plan {
  let balance = Math.max(0, balanceStart - lump);
  let interest = 0;
  let paid = lump;
  let months = 0;
  const monthlyRate = rateYear / 1200;
  if (balance <= 0) return { title: "", months: 0, interest: 0, paid };
  for (let i = 0; i < Math.min(600, monthsLimit || 600); i++) {
    const monthInterest = balance * monthlyRate;
    interest += monthInterest;
    const due = balance + monthInterest;
    const regular = Math.min(payment, due);
    const extra = Math.min(extraMonthly, Math.max(0, due - regular));
    const monthPaid = regular + extra;
    if (monthPaid <= 0) break;
    balance = Math.max(0, due - monthPaid);
    paid += monthPaid;
    months++;
    if (balance < 0.01) break;
  }
  return { title: "", months, interest, paid };
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
    const base = simulate(principal, num(rate), regularPayment, monthsLimit);
    const accelerated = simulate(principal, num(rate), regularPayment, monthsLimit, num(extraMonthly), num(lump));
    return {
      base,
      result: {
        ...accelerated,
        saving: Math.max(0, base.interest - accelerated.interest),
        monthsSaved: Math.max(0, base.months - accelerated.months),
      },
      estimated: !remainingYears.trim(),
    };
  }, [balance, rate, payment, remainingYears, extraMonthly, lump]);
  const best = plans.result;
  return <section className="space-y-5">
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#E2E7ED] bg-white p-4 dark:border-[#354354] dark:bg-[#1B2632]">
        <div className="flex items-start gap-2"><Calculator className="mt-0.5 size-5 shrink-0 text-[#E83C35]" /><div><h2 className="font-semibold">Стратегия погашения</h2><p className="mt-1 text-sm text-[#748195]">Введите параметры действующего кредита и дополнительные суммы, которые клиент готов направлять на досрочное погашение.</p></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Остаток основного долга" value={balance} onChange={setBalance} />
          <Field label="Текущий ежемесячный платёж" value={payment} onChange={setPayment} />
          <Field label="Процентная ставка" value={rate} onChange={setRate} suffix="%" step={0.1} />
          <Field label="Оставшийся срок по графику (необязательно)" value={remainingYears} onChange={setRemainingYears} suffix="лет" step={1} hint="Если не указывать, срок будет рассчитан автоматически." />
          <Field label="Дополнительно каждый месяц" value={extraMonthly} onChange={setExtraMonthly} hint="Оставьте пустым, если доплат не будет." />
          <Field label="Разовый досрочный взнос" value={lump} onChange={setLump} hint="Оставьте пустым, если разового взноса не будет." />
        </div>
      </div>
      <div className="rounded-2xl border border-[#E2E7ED] bg-white p-4 dark:border-[#354354] dark:bg-[#1B2632]">
        <div className="flex items-center gap-2"><BadgeCheck className="size-5 text-[#E83C35]" /><h3 className="font-semibold">Ваша выгода от досрочного погашения</h3></div>
        <div className="mt-3 rounded-xl bg-[#FCEBEA] p-3 dark:bg-[#352322]">
          <div className="text-xs font-semibold text-[#9B302B] dark:text-[#F09A94]">Экономия на процентах</div>
          <div className="mt-1 text-2xl font-bold text-[#B8322D] dark:text-[#F09A94]">{money(best.saving)}</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div><div className="text-xs text-[#748195]">Сокращение срока</div><div className="mt-1 text-lg font-bold text-[#26364A] dark:text-[#E6ECF3]">{duration(best.monthsSaved)}</div></div>
            <div><div className="text-xs text-[#748195]">Ипотека закроется через</div><div className="mt-1 text-lg font-bold text-[#26364A] dark:text-[#E6ECF3]">{duration(best.months)}</div></div>
            <div><div className="text-xs text-[#748195]">Проценты с досрочными платежами</div><div className="mt-1 font-semibold text-[#26364A] dark:text-[#E6ECF3]">{money(best.interest)}</div></div>
            <div><div className="text-xs text-[#748195]">Без досрочных платежей</div><div className="mt-1 font-semibold text-[#26364A] dark:text-[#E6ECF3]">{money(plans.base.interest)}</div></div>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[#647184] dark:text-[#AAB6C5]">При указанных дополнительных платежах клиент сэкономит на процентах <strong className="text-[#26364A] dark:text-[#E6ECF3]">{money(best.saving)}</strong> и закроет ипотеку на <strong className="text-[#26364A] dark:text-[#E6ECF3]">{duration(best.monthsSaved)}</strong> раньше обычного графика.</p>
        {plans.estimated && <p className="mt-2 text-xs text-[#748195]">Оставшийся срок рассчитан автоматически по сумме долга, ставке и текущему платежу. Результат ориентировочный.</p>}
      </div>
      <div className="rounded-xl bg-[#F3F5F8] p-3 text-xs leading-relaxed text-[#748195] dark:bg-[#111820]">Ориентировочная модель: дополнительные суммы уменьшают основной долг, а регулярный платёж сохраняется, поэтому срок сокращается. Разовый взнос учитывается в начале расчёта. Фактический результат зависит от даты внесения, порядка перерасчёта и условий банка. Перед внесением денег проверьте новый график в приложении банка.</div>
    </div>
    <div className="flex items-start gap-2 rounded-xl bg-[#F3F5F8] p-3 text-xs text-[#748195] dark:bg-[#111820]"><Wallet className="mt-0.5 size-4 shrink-0" />Расчёт предварительный и не заменяет банковский график платежей.</div>
  </section>;
}
