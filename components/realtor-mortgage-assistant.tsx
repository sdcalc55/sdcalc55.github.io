"use client";

import { useMemo, useState } from "react";
import { Calculator, GitCompareArrows, House, RefreshCw } from "lucide-react";

type Mode = "purchase" | "compare" | "sale";
const money = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(Number.isFinite(value) ? value : 0)) + " ₽";
const numberValue = (value: string) => Math.max(0, Number(value) || 0);
function Field({ label, value, onChange, suffix = "₽", min = 0, step = 10000 }: { label: string; value: string; onChange: (value: string) => void; suffix?: string; min?: number; step?: number }) {
  return <label className="block min-w-0"><span className="mb-1.5 block text-sm font-medium text-[#647184] dark:text-[#AAB6C5]">{label}</span><span className="flex items-center rounded-xl border border-[#DCE2E9] bg-white px-3 dark:border-[#405064] dark:bg-[#111820]"><input type="number" min={min} step={step} value={value} onChange={event => onChange(event.target.value)} className="min-w-0 w-full bg-transparent py-3 text-base font-semibold tabular-nums text-[#26364A] outline-none dark:text-[#E6ECF3]" /><span className="pl-2 text-sm text-[#8993A2]">{suffix}</span></span></label>;
}
function Payment({ price, down, rate, years }: { price: number; down: number; rate: number; years: number }) {
  const principal = Math.max(0, price - down);
  const months = Math.max(1, years * 12);
  const monthlyRate = rate / 1200;
  const payment = monthlyRate === 0 ? principal / months : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
  return { principal, payment, total: payment * months, interest: payment * months - principal, months };
}
function Result({ label, value, primary = false }: { label: string; value: string; primary?: boolean }) {
  return <div className={`rounded-xl p-3 ${primary ? "bg-[#FCEBEA] dark:bg-[#352322]" : "bg-[#F3F5F8] dark:bg-[#111820]"}`}><div className="text-xs text-[#748195]">{label}</div><div className={`mt-1 text-lg font-bold tabular-nums ${primary ? "text-[#B8322D] dark:text-[#F09A94]" : "text-[#26364A] dark:text-[#E6ECF3]"}`}>{value}</div></div>;
}
export function RealtorMortgageAssistant() {
  const [mode, setMode] = useState<Mode>("purchase");
  const [price, setPrice] = useState("6000000");
  const [down, setDown] = useState("1200000");
  const [rate, setRate] = useState("6");
  const [years, setYears] = useState("20");
  const [priceA, setPriceA] = useState("5500000");
  const [priceB, setPriceB] = useState("6500000");
  const [downCompare, setDownCompare] = useState("1100000");
  const [salePrice, setSalePrice] = useState("7000000");
  const [debt, setDebt] = useState("2500000");
  const [ownFunds, setOwnFunds] = useState("500000");
  const [newPrice, setNewPrice] = useState("8500000");
  const purchase = useMemo(() => Payment({ price: numberValue(price), down: numberValue(down), rate: numberValue(rate), years: Math.max(1, numberValue(years)) }), [price, down, rate, years]);
  const a = useMemo(() => Payment({ price: numberValue(priceA), down: numberValue(downCompare), rate: numberValue(rate), years: Math.max(1, numberValue(years)) }), [priceA, downCompare, rate, years]);
  const b = useMemo(() => Payment({ price: numberValue(priceB), down: numberValue(downCompare), rate: numberValue(rate), years: Math.max(1, numberValue(years)) }), [priceB, downCompare, rate, years]);
  const saleNet = Math.max(0, numberValue(salePrice) - numberValue(debt));
  const funds = saleNet + numberValue(ownFunds);
  const additionalLoan = Math.max(0, numberValue(newPrice) - funds);
  const salePayment = Payment({ price: numberValue(newPrice), down: funds, rate: numberValue(rate), years: Math.max(1, numberValue(years)) });
  const modes = [{ id: "purchase" as const, label: "Покупка", icon: House }, { id: "compare" as const, label: "Сравнение", icon: GitCompareArrows }, { id: "sale" as const, label: "Продажа + покупка", icon: RefreshCw }];
  return <section className="space-y-5">
    <div className="rounded-2xl border border-[#E2E7ED] bg-white p-4 dark:border-[#354354] dark:bg-[#1B2632]"><p className="text-sm text-[#748195]">Инструмент для консультации с клиентом</p><div className="mt-1 text-lg font-semibold">Подберите подходящий сценарий сделки</div><p className="mt-1 text-sm text-[#748195]">Расчёты ориентировочные. Фактические условия зависят от банка и программы кредитования.</p></div>
    <div role="tablist" aria-label="Сценарий консультации" className="grid grid-cols-3 gap-1 rounded-2xl border border-[#E2E7ED] bg-[#EEF1F5] p-1 dark:border-[#405064] dark:bg-[#111820]">{modes.map(item => { const Icon = item.icon; return <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} onClick={() => setMode(item.id)} className={`flex min-h-12 items-center justify-center gap-1 rounded-xl px-1 text-xs font-semibold transition sm:gap-2 sm:text-sm ${mode === item.id ? "bg-[#E83C35] text-white shadow-sm" : "text-[#647184] dark:text-[#AAB6C5]"}`}><Icon className="size-4 shrink-0" /><span>{item.label}</span></button>; })}</div>
    {mode !== "sale" && <div className="grid gap-3 rounded-2xl border border-[#E2E7ED] bg-white p-4 dark:border-[#354354] dark:bg-[#1B2632] sm:grid-cols-2"><Field label="Процентная ставка" value={rate} onChange={setRate} suffix="%" step={0.1} /><Field label="Срок кредита" value={years} onChange={setYears} suffix="лет" step={1} /></div>}
    {mode === "purchase" && <div className="space-y-4 rounded-2xl border border-[#E2E7ED] bg-white p-4 dark:border-[#354354] dark:bg-[#1B2632]"><h2 className="font-semibold">Покупка недвижимости в ипотеку</h2><div className="grid gap-3 sm:grid-cols-2"><Field label="Стоимость недвижимости" value={price} onChange={setPrice} /><Field label="Первоначальный взнос" value={down} onChange={setDown} /></div><div className="grid gap-3 sm:grid-cols-2"><Result label="Сумма кредита" value={money(purchase.principal)} primary /><Result label="Ежемесячный платёж" value={money(purchase.payment)} primary /><Result label="Проценты за весь срок" value={money(purchase.interest)} /><Result label="Общая сумма выплат банку" value={money(purchase.total)} /></div><p className="text-xs text-[#748195]">На первоначальный взнос потребуется {money(numberValue(down))}. Доля взноса: {numberValue(price) ? (numberValue(down) / numberValue(price) * 100).toFixed(1).replace(".", ",") : "0"}%.</p></div>}
    {mode === "compare" && <div className="space-y-4 rounded-2xl border border-[#E2E7ED] bg-white p-4 dark:border-[#354354] dark:bg-[#1B2632]"><h2 className="font-semibold">Сравнение двух объектов</h2><div className="grid gap-3 sm:grid-cols-2"><Field label="Стоимость объекта №1" value={priceA} onChange={setPriceA} /><Field label="Стоимость объекта №2" value={priceB} onChange={setPriceB} /><Field label="Первоначальный взнос" value={downCompare} onChange={setDownCompare} /></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2 rounded-xl border border-[#E2E7ED] p-3 dark:border-[#405064]"><h3 className="font-semibold">Объект №1</h3><Result label="Кредит" value={money(a.principal)} /><Result label="Платёж в месяц" value={money(a.payment)} primary /></div><div className="space-y-2 rounded-xl border border-[#E2E7ED] p-3 dark:border-[#405064]"><h3 className="font-semibold">Объект №2</h3><Result label="Кредит" value={money(b.principal)} /><Result label="Платёж в месяц" value={money(b.payment)} primary /></div></div><div className="rounded-xl bg-[#FCEBEA] p-3 text-sm text-[#8F302C] dark:bg-[#352322] dark:text-[#F09A94]">Разница в ежемесячном платеже: <strong>{money(Math.abs(a.payment - b.payment))}</strong>. За весь срок разница в процентах: <strong>{money(Math.abs(a.interest - b.interest))}</strong>.</div></div>}
    {mode === "sale" && <div className="space-y-4 rounded-2xl border border-[#E2E7ED] bg-white p-4 dark:border-[#354354] dark:bg-[#1B2632]"><h2 className="font-semibold">Продажа недвижимости и следующая покупка</h2><div className="grid gap-3 sm:grid-cols-2"><Field label="Цена продажи текущего объекта" value={salePrice} onChange={setSalePrice} /><Field label="Остаток ипотеки / долга" value={debt} onChange={setDebt} /><Field label="Дополнительные накопления" value={ownFunds} onChange={setOwnFunds} /><Field label="Стоимость нового объекта" value={newPrice} onChange={setNewPrice} /></div><div className="grid gap-3 sm:grid-cols-2"><Result label="Средства после погашения долга" value={money(saleNet)} /><Result label="Всего средств на покупку" value={money(funds)} primary /><Result label="Необходимая сумма кредита" value={money(additionalLoan)} primary /><Result label="Ориентировочный платёж в месяц" value={money(salePayment.payment)} /></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Процентная ставка" value={rate} onChange={setRate} suffix="%" step={0.1} /><Field label="Срок кредита" value={years} onChange={setYears} suffix="лет" step={1} /></div><p className="text-xs text-[#748195]">Без учёта расходов на сделку, налогов, комиссий и возможного разрыва между продажей и покупкой.</p></div>}
    <div className="flex items-start gap-2 rounded-xl bg-[#F3F5F8] p-3 text-xs text-[#748195] dark:bg-[#111820]"><Calculator className="mt-0.5 size-4 shrink-0" />Расчёт аннуитетный, без учёта страхования, дополнительных услуг, субсидий и индивидуальных условий банка.</div>
  </section>;
}
