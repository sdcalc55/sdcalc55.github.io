"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { focusNextCalculatorInput } from "@/lib/calculator-input";
import { formatInput } from "@/lib/calculator";
import { scrollFocusedInputIntoView } from "@/lib/scroll-focused-input";
import { Calculator, CalendarClock, Target, RotateCcw } from "lucide-react";
import { calculatePrepayment, estimateRemainingBalance, findPrepaymentAmount, type PlannerGoal, type PrepaymentResult } from "@/lib/prepayment";
const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const rub = (v: number) => `${money.format(v)} ₽`;
const parse = (v: string) => { const n = v.replace(/[\s\u00a0\u202f]/g, "").replace(",", "."); return /^\d+(?:\.\d+)?$/.test(n) ? Number(n) : NaN; };
type Mode = "quick" | "detailed" | "planner";
export function PrepaymentCalculator() {
  const [mode,setMode]=useState<Mode>("quick"), [unknown,setUnknown]=useState(false);
  const [balance,setBalance]=useState(""), [principal,setPrincipal]=useState(""), [startDate,setStartDate]=useState("");
  const [rate,setRate]=useState(""), [payment,setPayment]=useState(""), [extra,setExtra]=useState(""), [payDate,setPayDate]=useState(()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");});
  const [goal,setGoal]=useState<PlannerGoal>("payment"), [target,setTarget]=useState("40000");
  const [result,setResult]=useState<PrepaymentResult|null>(null), [picked,setPicked]=useState<number|null>(null), [error,setError]=useState(""), [showDetails,setShowDetails]=useState(false);
  const inputClass="mt-2 h-14 w-full rounded-xl border border-[#E4E8ED] bg-[#F7F8FA] px-4 text-base font-medium tabular-nums text-[#26364A] outline-none transition placeholder:text-sm placeholder:font-normal placeholder:text-[#8993A2] focus:border-[#E83C35] focus:ring-4 focus:ring-[#E83C35]/10 dark:border-[#405064] dark:bg-[#111820] dark:text-[#E6ECF3]";

  const calculate=()=>{try{setError("");let current=parse(balance);if(unknown)current=estimateRemainingBalance(parse(principal),parse(rate),parse(payment),startDate).balance;
    const base={balance:current,monthlyPayment:parse(payment),annualRate:parse(rate)};
    if(mode==="planner"){const amount=findPrepaymentAmount(base,goal,parse(target));setPicked(amount);setResult(calculatePrepayment({...base,extraPayment:amount}));}
    else{setPicked(null);setResult(calculatePrepayment({...base,extraPayment:parse(extra)}));}
  }catch(e){setResult(null);setPicked(null);setError(e instanceof Error?e.message:"Не удалось выполнить расчёт.");}};
  const reset=()=>{setBalance("");setPrincipal("");setStartDate("");setRate("");setPayment("");setExtra("");setTarget("");setResult(null);setPicked(null);setError("");};
  const closingDate=(months:number)=>{const d=new Date(payDate+"T12:00:00");d.setMonth(d.getMonth()+Math.max(0,months-1));return d.toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"});};
  const card=(title:string,data:PrepaymentResult["shorten"],saved:number)=><section className="rounded-2xl border border-[#E1E6ED] bg-white p-4 dark:border-[#405064] dark:bg-[#1B2632]"><h3 className="font-semibold text-[#26364A] dark:text-[#F1F5F9]">{title}</h3><p className="mt-2 text-2xl font-bold tabular-nums text-[#E83C35]">{rub(saved)}</p><p className="text-xs text-[#748195]">Экономия на процентах</p><dl className="mt-4 space-y-2 text-sm"><Row label="Ежемесячный платёж" value={rub(data.monthlyPayment)}/><Row label="Срок после досрочного взноса" value={data.months+" мес."}/><Row label="Переплата по процентам" value={rub(data.interest)}/><Row label="Последний платёж" value={rub(data.finalPayment)}/></dl></section>;
  return <div className="space-y-5">
    <div className="grid grid-cols-3 gap-1 rounded-2xl border border-[#E4E8ED] bg-[#EEF1F5] p-1 dark:border-[#405064] dark:bg-[#111820]" role="tablist" aria-label="Режим досрочного погашения">
      {([{id:"quick",label:"Быстрый расчёт",Icon:Calculator},{id:"detailed",label:"Подробный расчёт",Icon:CalendarClock},{id:"planner",label:"Подбор суммы",Icon:Target}] as const).map(item=><button key={item.id} type="button" role="tab" aria-selected={mode===item.id} onClick={()=>{setMode(item.id);setResult(null);setError("");setPicked(null);}} className={`min-h-12 rounded-xl px-1 py-2 text-xs font-semibold transition sm:text-sm ${mode===item.id?"bg-white text-[#26364A] shadow-sm dark:bg-[#253241] dark:text-white":"text-[#748195]"}`}><item.Icon className="mx-auto mb-1 size-4"/><span>{item.label}</span></button>)}
    </div>
    <section className="rounded-3xl border border-[#E1E6ED] bg-white p-5 shadow-[0_4px_20px_#26364A05] dark:border-[#405064] dark:bg-[#1B2632] sm:p-7">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-[#26364A] dark:text-[#F1F5F9]">Параметры ипотеки</h2><p className="mt-1 text-sm text-[#748195]">Аннуитетный платёж · досрочный взнос в дату очередного платежа</p></div><button type="button" onClick={()=>setUnknown(v=>!v)} className="text-left text-sm font-semibold text-[#E83C35] underline-offset-4 hover:underline">{unknown?"Знаю остаток долга":"Не знаю остаток долга"}</button></div>
      {unknown?<div className="grid gap-4 sm:grid-cols-2"><InputField className={inputClass} label="Первоначальная сумма кредита, ₽" value={principal} onChange={setPrincipal}/><InputField className={inputClass} label="Дата оформления кредита" value={startDate} onChange={setStartDate} type="month"/><InputField money={false} className={inputClass} label="Процентная ставка, % годовых" value={rate} onChange={setRate}/><InputField className={inputClass} label="Ежемесячный платёж, ₽" value={payment} onChange={setPayment}/></div>:<div className="grid gap-4 sm:grid-cols-2"><InputField className={inputClass} label="Текущий остаток долга, ₽" value={balance} onChange={setBalance}/><InputField money={false} maxValue={30} className={inputClass} label="Процентная ставка, % годовых" value={rate} onChange={setRate}/><InputField className={inputClass} label="Ежемесячный платёж, ₽" value={payment} onChange={setPayment}/></div>}
      {mode!=="planner"?<div className="mt-4 grid gap-4 sm:grid-cols-2"><InputField className={inputClass} label="Сумма досрочного погашения, ₽" value={extra} onChange={setExtra}/>{mode==="detailed"&&<InputField className={inputClass} label="Дата очередного платежа" value={payDate} onChange={setPayDate} type="date"/>}</div>:<div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-[#596779] dark:text-[#C5D0DC]">Желаемый результат<select value={goal} onChange={e=>setGoal(e.target.value as PlannerGoal)} className={inputClass}><option value="payment">Снизить платёж до суммы</option><option value="months">Сократить срок на месяцы</option><option value="interest">Сэкономить на процентах</option></select></label><InputField money={goal==="payment"||goal==="interest"} className={inputClass} label={goal==="payment"?"Желаемый ежемесячный платёж, ₽":goal==="months"?"На сколько месяцев сократить срок":"Желаемая экономия, ₽"} value={target} onChange={setTarget}/></div>}
      {mode==="detailed"&&<div className="mt-4"><button type="button" onClick={()=>setShowDetails(v=>!v)} className="text-sm font-semibold text-[#647184] dark:text-[#C5D0DC]">{showDetails?"Скрыть допущения":"Показать допущения расчёта"}</button>{showDetails&&<p className="mt-2 rounded-xl bg-[#F5F7FA] p-3 text-xs leading-relaxed text-[#647184] dark:bg-[#111820] dark:text-[#B8C4D2]">Используется месячная ставка (годовая / 12). Сначала учитывается очередной платёж, затем досрочное погашение. Реальный график банка может отличаться из-за ежедневного начисления процентов, дат и округлений.</p>}</div>}
      {error&&<p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={calculate} className="min-h-12 flex-1 rounded-xl bg-[#E83C35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#D9342E]">Рассчитать</button><button type="button" onClick={reset} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#DCE2E9] px-4 py-3 text-sm font-semibold text-[#647184] hover:bg-[#F5F7FA] dark:border-[#405064] dark:text-[#D5DEE8]"><RotateCcw className="size-4"/>Сбросить</button></div>
    </section>
    {result&&<section aria-live="polite" className="space-y-4"><div className="rounded-2xl border border-[#D9E4EF] bg-[#F5F8FC] p-4 dark:border-[#405064] dark:bg-[#111820]"><p className="text-sm font-semibold text-[#26364A] dark:text-[#E6ECF3]">Результат расчёта</p><p className="mt-1 text-sm text-[#647184] dark:text-[#B8C4D2]">Без досрочного погашения: {result.baseline.months} мес., проценты {rub(result.baseline.interest)}</p><p className="mt-1 text-sm text-[#647184] dark:text-[#B8C4D2]">Учтённый досрочный взнос: {rub(result.appliedExtra)}</p>{mode==="detailed"&&<p className="mt-1 text-sm text-[#647184] dark:text-[#B8C4D2]">Ориентировочная дата закрытия при сокращении срока: {closingDate(result.shorten.months)}</p>}{picked!==null&&<p className="mt-2 text-lg font-bold text-[#E83C35]">Рекомендуемая сумма: {rub(picked)}</p>}</div><div className="grid gap-4 lg:grid-cols-2">{card("1. Сократить срок",result.shorten,Math.max(0,result.baseline.interest-result.shorten.interest))}{card("2. Уменьшить платёж",result.reduce,Math.max(0,result.baseline.interest-result.reduce.interest))}</div><p className="text-xs leading-relaxed text-[#748195]">Предварительный расчёт, не банковский график. Приблизительный остаток может отличаться, если менялась ставка, были каникулы или предыдущие досрочные погашения.</p></section>}
  </div>;
}
function InputField({label,value,onChange,type="text",hint,className,money=true,maxValue}:{label:string;value:string;onChange:(v:string)=>void;type?:"text"|"date"|"month";hint?:string;className:string;money?:boolean;maxValue?:number}){
  const ref=useRef<HTMLInputElement>(null);
  const cursor=useRef<number|null>(null);
  const [,render]=useState(0);
  useLayoutEffect(()=>{if(cursor.current!==null){ref.current?.setSelectionRange(cursor.current,cursor.current);cursor.current=null;}});
  const numeric=type==="text";
  return <div className="min-w-0"><label className="mb-2 block text-sm font-semibold text-[#596779] dark:text-[#D5DEE8]">{label}</label><div className="relative">
    <input ref={ref} type={type} value={value} inputMode={numeric?"decimal":undefined} autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="next" autoComplete="off" onFocus={e=>scrollFocusedInputIntoView(e.currentTarget)} onClick={e=>scrollFocusedInputIntoView(e.currentTarget)} onKeyDown={e=>{if(e.key==="-"||e.key==="−"||e.key==="Subtract")e.preventDefault();if(e.key==="Enter"&&!e.nativeEvent.isComposing){e.preventDefault();focusNextCalculatorInput(e.currentTarget);}}} onChange={e=>{
      if(!numeric){onChange(e.target.value);return;}
      const raw=e.target.value.replace(/[^\d.,]/g,"").replace(/([.,].*)[.,]/g,"$1");
      const digits=raw.replace(/[\s\u00a0\u202f]/g,"").split(/[.,]/)[0].replace(/^0+/,"");
      if(money&&digits.length>10)return;
      const position=e.target.selectionStart??raw.length;
      const significant=raw.slice(0,position).replace(/[\s\u00a0\u202f]/g,"").length;
      const normalized=raw.replace(",",".");
      const candidateParts=normalized.split(".");
      const candidate=candidateParts.length>2?candidateParts[0]+"."+candidateParts.slice(1).join(""):normalized;
      const number=Number(candidate);
      if(!money&&candidate!==""&&Number.isFinite(number)&&maxValue!==undefined&&number>maxValue)return;
      const next=money?formatInput(raw):candidate;
      let index=0,count=0;while(index<next.length&&count<significant){if(!/[\s\u00a0\u202f]/.test(next[index]))count++;index++;}
      cursor.current=index;onChange(next);render(n=>n+1);
    }} className={`${className} ${numeric?"pr-10 text-lg font-medium tabular-nums":"pr-3"}`} />
    {numeric&&value!==""&&<button type="button" aria-label="Очистить поле" title="Очистить" onMouseDown={e=>e.preventDefault()} onClick={()=>{onChange("");ref.current?.focus();}} className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[#8993A2] hover:bg-black/5 hover:text-[#26364A] dark:hover:bg-white/10 dark:hover:text-white"><X className="size-4"/></button>}
  </div>{hint&&<span className="mt-1 block text-xs font-normal text-[#8490A0]">{hint}</span>}</div>;
}
function Row({label,value}:{label:string;value:string}){return <div className="flex flex-wrap justify-between gap-2"><dt className="text-[#647184] dark:text-[#B8C4D2]">{label}</dt><dd className="font-semibold tabular-nums text-[#26364A] dark:text-[#F1F5F9]">{value}</dd></div>;}
