"use client";

import { useMemo, useState } from "react";
import { useState as useLocalState } from "react";
import { Calculator, RefreshCw, TrendingDown, Wallet, BadgeCheck } from "lucide-react";
import { PrepaymentCalculator } from "@/components/prepayment-calculator";

type Mode = "sale" | "strategy";
const money = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(Number.isFinite(value) ? value : 0)) + " ₽";
const num = (value: string) => Math.max(0, Number(value) || 0);
function Field({ label, value, onChange, suffix = "₽", step = 10000, hint }: { label: string; value: string; onChange: (value: string) => void; suffix?: string; step?: number; hint?: string }) {
  return <label className="block min-w-0"><span className="mb-1.5 block text-sm font-medium text-[#647184] dark:text-[#AAB6C5]">{label}</span><span className="flex items-center rounded-xl border border-[#DCE2E9] bg-white px-3 dark:border-[#405064] dark:bg-[#111820]"><input type="number" min="0" step={step} value={value} onChange={event => onChange(event.target.value)} className="min-w-0 w-full bg-transparent py-3 text-base font-semibold tabular-nums text-[#26364A] outline-none dark:text-[#E6ECF3]" /><span className="pl-2 text-sm text-[#8993A2]">{suffix}</span></span>{hint && <span className="mt-1 block text-xs text-[#8993A2]">{hint}</span>}</label>;
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
  const [mode, setMode] = useState<Mode>("sale");
  const [paymentType, setPaymentType] = useState<"monthly" | "lump" | "both">("both");
  const [showDetailed, setShowDetailed] = useState(false);
  const [salePrice, setSalePrice] = useState("7000000");
  const [debt, setDebt] = useState("2500000");
  const [ownFunds, setOwnFunds] = useState("500000");
  const [newPrice, setNewPrice] = useState("8500000");
  const [rate, setRate] = useState("6");
  const [years, setYears] = useState("20");
  const [balance, setBalance] = useState("4500000");
  const [payment, setPayment] = useState("42000");
  const [extraMonthly, setExtraMonthly] = useState("10000");
  const [lump, setLump] = useState("200000");
  const saleNet = Math.max(0, num(salePrice) - num(debt));
  const funds = saleNet + num(ownFunds);
  const additionalLoan = Math.max(0, num(newPrice) - funds);
  const salePayment = (() => {
    const principal = additionalLoan, count = Math.max(1, num(years) * 12), monthly = num(rate) / 1200;
    return monthly === 0 ? principal / count : principal * monthly / (1 - Math.pow(1 + monthly, -count));
  })();
  const plans = useMemo(() => {
    const monthsLimit = Math.max(1, Math.min(600, Math.round(num(years) * 12) || 360));
    const base = simulate(num(balance), num(rate), num(payment), monthsLimit);
    const monthly = simulate(num(balance), num(rate), num(payment), monthsLimit, paymentType === "monthly" || paymentType === "both" ? num(extraMonthly) : 0);
    const oneTime = simulate(num(balance), num(rate), num(payment), monthsLimit, 0, paymentType === "lump" || paymentType === "both" ? num(lump) : 0);
    const combined = simulate(num(balance), num(rate), num(payment), monthsLimit, paymentType === "monthly" || paymentType === "both" ? num(extraMonthly) : 0, paymentType === "lump" || paymentType === "both" ? num(lump) : 0);
    return [
      { key: "base", title: "Платить по графику", ...base, saving: 0, monthsSaved: 0, extra: 0 },
      { key: "monthly", title: "Доплачивать каждый месяц", ...monthly, saving: Math.max(0, base.interest - monthly.interest), monthsSaved: Math.max(0, base.months - monthly.months), extra: num(extraMonthly) },
      { key: "lump", title: "Внести разовую сумму", ...oneTime, saving: Math.max(0, base.interest - oneTime.interest), monthsSaved: Math.max(0, base.months - oneTime.months), extra: num(lump) },
      { key: "combined", title: "Совместить оба способа", ...combined, saving: Math.max(0, base.interest - combined.interest), monthsSaved: Math.max(0, base.months - combined.months), extra: num(extraMonthly) + num(lump) },
    ];
  }, [balance, rate, payment, years, extraMonthly, lump, paymentType]);
  const best = plans.slice(1).reduce((a, b) => b.saving > a.saving ? b : a, plans[1]);
  const tabs = [{ id: "sale" as const, label: "Продажа + покупка", icon: RefreshCw }, { id: "strategy" as const, label: "Стратегия погашения", icon: TrendingDown }];
  return <section className="space-y-5">
    <div role="tablist" aria-label="Сценарий консультации" className="grid grid-cols-2 gap-1 rounded-2xl border border-[#E2E7ED] bg-[#EEF1F5] p-1 dark:border-[#405064] dark:bg-[#111820]">{tabs.map(item => { const Icon = item.icon; return <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} onClick={() => setMode(item.id)} className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition sm:gap-2 sm:text-sm ${mode === item.id ? "bg-[#E83C35] text-white shadow-sm" : "text-[#647184] dark:text-[#AAB6C5]"}`}><Icon className="size-4 shrink-0" /><span>{item.label}</span></button>; })}</div>
    {mode === "sale" && <div className="space-y-4 rounded-2xl border border-[#E2E7ED] bg-white p-4 dark:border-[#354354] dark:bg-[#1B2632]"><div><h2 className="font-semibold">Продажа недвижимости и следующая покупка</h2><p className="mt-1 text-sm text-[#748195]">Посчитайте, сколько средств останется после продажи и какая сумма понадобится на новый объект.</p></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Цена продажи текущего объекта" value={salePrice} onChange={setSalePrice} /><Field label="Остаток ипотеки / долга" value={debt} onChange={setDebt} /><Field label="Дополнительные накопления" value={ownFunds} onChange={setOwnFunds} /><Field label="Стоимость нового объекта" value={newPrice} onChange={setNewPrice} /></div><div className="grid gap-3 sm:grid-cols-2"><Result label="Средства после погашения долга" value={money(saleNet)} /><Result label="Всего средств на покупку" value={money(funds)} primary /><Result label="Необходимая сумма кредита" value={money(additionalLoan)} primary /><Result label="Ориентировочный платёж в месяц" value={money(salePayment)} /></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Процентная ставка" value={rate} onChange={setRate} suffix="%" step={0.1} /><Field label="Срок нового кредита" value={years} onChange={setYears} suffix="лет" step={1} /></div><p className="text-xs text-[#748195]">Без учёта расходов на сделку, налогов, комиссий и возможного разрыва между продажей и покупкой.</p></div>}
    {mode === "strategy" && <div className="space-y-4">
      <div className="rounded-2xl border border-[#E2E7ED] bg-white p-4 dark:border-[#354354] dark:bg-[#1B2632]"><div className="flex items-start gap-2"><Calculator className="mt-0.5 size-5 shrink-0 text-[#E83C35]" /><div><h2 className="font-semibold">Как быстрее закрыть ипотеку</h2><p className="mt-1 text-sm text-[#748195]">Введите параметры действующего кредита и дополнительные суммы, которые клиент готов направлять на досрочное погашение.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Остаток основного долга" value={balance} onChange={setBalance} /><Field label="Текущий ежемесячный платёж" value={payment} onChange={setPayment} /><Field label="Процентная ставка" value={rate} onChange={setRate} suffix="%" step={0.1} /><Field label="Оставшийся срок по графику" value={years} onChange={setYears} suffix="лет" step={1} /><label className="block min-w-0 sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-[#647184] dark:text-[#AAB6C5]">Как планируете вносить досрочные платежи?</span><select value={paymentType} onChange={event => setPaymentType(event.target.value as "monthly" | "lump" | "both")} className="w-full rounded-xl border border-[#DCE2E9] bg-white px-3 py-3 text-base font-semibold text-[#26364A] outline-none dark:border-[#405064] dark:bg-[#111820] dark:text-[#E6ECF3]"><option value="monthly">Доплачивать каждый месяц</option><option value="lump">Внести разовый платёж</option><option value="both">Разовый платёж + ежемесячные доплаты</option></select></label>{(paymentType === "monthly" || paymentType === "both") && <Field label="Дополнительно каждый месяц" value={extraMonthly} onChange={setExtraMonthly} hint="Сумма сверх текущего платежа" />}{(paymentType === "lump" || paymentType === "both") && <Field label="Разовый досрочный взнос" value={lump} onChange={setLump} hint="Учитывается в начале расчёта" />}</div></div>
      <div className="rounded-2xl border border-[#E2E7ED] bg-white p-4 dark:border-[#354354] dark:bg-[#1B2632]"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Сравнение сценариев</h3><p className="mt-1 text-xs text-[#748195]">Сравнение с выплатой по текущему графику</p></div><BadgeCheck className="size-5 text-[#E83C35]" /></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><Result label="Без досрочных платежей" value={duration(plans[0].months)} detail={`Проценты: ${money(plans[0].interest)}`} /><Result label="При выбранных доплатах" value={duration(best.months)} primary detail={`Проценты: ${money(best.interest)}`} /></div><div className="mt-3 rounded-xl bg-[#FCEBEA] p-3 dark:bg-[#352322]"><p className="text-sm font-semibold text-[#9B302B] dark:text-[#F09A94]">Наиболее выгодный из введённых сценариев: {best.title.toLocaleLowerCase("ru-RU")}</p><div className="mt-1 text-sm text-[#7E3834] dark:text-[#F2B0AA]">Экономия на процентах: <strong>{money(best.saving)}</strong>. Ипотека закроется на <strong>{duration(best.monthsSaved)}</strong> раньше.</div></div><div className="mt-4 space-y-3">{plans.map((plan, index) => <div key={plan.key} className="rounded-xl border border-[#E2E7ED] p-3 dark:border-[#405064]"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-[#26364A] dark:text-[#E6ECF3]">{plan.title}</h4>{index === 0 ? <span className="text-xs text-[#748195]">Базовый вариант</span> : <span className="text-sm font-bold text-[#E83C35]">Экономия {money(plan.saving)}</span>}</div><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><div className="text-xs text-[#748195]">Срок до закрытия</div><div className="mt-1 font-semibold">{duration(plan.months)}</div></div><div><div className="text-xs text-[#748195]">Проценты банку</div><div className="mt-1 font-semibold">{money(plan.interest)}</div></div><div><div className="text-xs text-[#748195]">Сокращение срока</div><div className="mt-1 font-semibold">{duration(plan.monthsSaved)}</div></div><div><div className="text-xs text-[#748195]">Всего выплат с учётом доплат</div><div className="mt-1 font-semibold">{money(plan.paid)}</div></div></div></div>)}</div></div>
      <div className="rounded-xl bg-[#F3F5F8] p-3 text-xs leading-relaxed text-[#748195] dark:bg-[#111820]">Ориентировочная модель: дополнительные суммы уменьшают основной долг, а регулярный платёж сохраняется, поэтому срок сокращается. Разовый взнос учитывается в начале расчёта. Фактический результат зависит от даты внесения, порядка перерасчёта и условий банка. Перед внесением денег выберите в приложении банка сокращение срока и проверьте новый график.</div>
      <div className="rounded-2xl border border-[#E2E7ED] bg-white p-4 dark:border-[#354354] dark:bg-[#1B2632]"><button type="button" onClick={() => setShowDetailed(value => !value)} className="flex w-full items-center justify-between gap-3 text-left font-semibold text-[#26364A] dark:text-[#E6ECF3]"><span>Подробный расчёт досрочного погашения</span><span className="text-[#E83C35]">{showDetailed ? "Скрыть" : "Открыть"}</span></button>{showDetailed && <div className="mt-4"><PrepaymentCalculator /></div>}</div>
    </div>}
    <div className="flex items-start gap-2 rounded-xl bg-[#F3F5F8] p-3 text-xs text-[#748195] dark:bg-[#111820]"><Wallet className="mt-0.5 size-4 shrink-0" />Расчёт предварительный и не заменяет банковский график платежей.</div>
  </section>;
}
