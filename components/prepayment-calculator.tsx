"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { focusNextCalculatorInput } from "@/lib/calculator-input";
import { formatInput } from "@/lib/calculator";
import { scrollFocusedInputIntoView } from "@/lib/scroll-focused-input";
import { Calculator, Target, RotateCcw } from "lucide-react";
import { calculatePlanOptions, calculatePrepayment, estimateRemainingBalance, findPrepaymentAmount, type PlannerGoal, type PrepaymentResult, type PlanOptions } from "@/lib/prepayment";
const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const rub = (v: number) => `${money.format(v)}\u00a0₽`;
const term = (months:number) => { const years=Math.floor(months/12), mod=years%10, last=years%100; const word=last>=11&&last<=14?"лет":mod===1?"год":mod>=2&&mod<=4?"года":"лет"; return years?`${years} ${word} (${months} мес.)`:`${months} мес.`; };
const parse = (v: string) => { const n = v.replace(/[\s\u00a0\u202f]/g, "").replace(",", "."); return /^\d+(?:\.\d+)?$/.test(n) ? Number(n) : NaN; };
type Mode = "quick" | "planner";
export function PrepaymentCalculator() {
  const [mode,setMode]=useState<Mode>("quick");
  const [balance,setBalance]=useState(""), [principal,setPrincipal]=useState(""), [startDate,setStartDate]=useState("");
  const [estimateInfo,setEstimateInfo]=useState<{balance:number;monthsPaid:number}|null>(null);
  const [rate,setRate]=useState(""), [payment,setPayment]=useState(""), [extra,setExtra]=useState(""), [monthlyExtra,setMonthlyExtra]=useState("");
  const [goal,setGoal]=useState<PlannerGoal>("payment"), [target,setTarget]=useState("");
  const [result,setResult]=useState<PrepaymentResult|null>(null), [planOptions,setPlanOptions]=useState<PlanOptions|null>(null), [picked,setPicked]=useState<number|null>(null), [error,setError]=useState(""), [showDetails,setShowDetails]=useState(false);
  const inputClass="mt-2 h-14 w-full rounded-xl border border-[#E4E8ED] bg-[#F7F8FA] px-4 text-base font-medium tabular-nums text-[#26364A] outline-none transition placeholder:text-sm placeholder:font-normal placeholder:text-[#8993A2] focus:border-[#E83C35] focus:ring-4 focus:ring-[#E83C35]/10 dark:border-[#405064] dark:bg-[#111820] dark:text-[#E6ECF3]";

  const calculate=()=>{try{
    setError("");setEstimateInfo(null);setPlanOptions(null);
    const hasBalance=balance.trim()!=="", hasPrincipal=principal.trim()!=="", hasStartDate=startDate.trim()!=="";
    let current=hasBalance?parse(balance):NaN, estimate:null|{balance:number;monthsPaid:number}=null;
    if(hasPrincipal&&hasStartDate&&!hasBalance){
      const match=startDate.trim().match(/^(0?[1-9]|1[0-2])[./](\d{4})$/);
      if(!match)throw new Error("Введите дату кредита в формате ММ.ГГГГ, например 08.2020.");
      estimate=estimateRemainingBalance(parse(principal),parse(rate),parse(payment),match[2]+"-"+match[1].padStart(2,"0"));
      if(!hasBalance)current=estimate.balance;
    }else if(!hasBalance){
      throw new Error("Для быстрого расчёта укажите текущий остаток долга. Если он неизвестен, заполните первоначальную сумму кредита и дату оформления.");
    }
    if((hasPrincipal&&!hasStartDate)||(!hasPrincipal&&hasStartDate)){
      if(!hasBalance)throw new Error("Чтобы рассчитать остаток по первоначальным данным, заполните и сумму кредита, и дату оформления.");
    }
    const base={balance:current,monthlyPayment:parse(payment),annualRate:parse(rate)};
    if(mode==="planner"){const amount=findPrepaymentAmount(base,goal,parse(target));setPicked(amount);setResult(calculatePrepayment({...base,extraPayment:amount}));}
    else{setPicked(null);setResult(calculatePrepayment({...base,extraPayment:extra.trim()?parse(extra):0}));setPlanOptions(calculatePlanOptions({...base,lumpSum:extra.trim()?parse(extra):0,monthlyExtra:monthlyExtra.trim()?parse(monthlyExtra):0}));}
    if(estimate)setEstimateInfo(estimate);
  }catch(e){setResult(null);setPlanOptions(null);setPicked(null);setEstimateInfo(null);setError(e instanceof Error?e.message:"Не удалось выполнить расчёт.");}};
  const reset=()=>{setBalance("");setPrincipal("");setStartDate("");setRate("");setPayment("");setExtra("");setMonthlyExtra("");setTarget("");setResult(null);setPlanOptions(null);setPicked(null);setEstimateInfo(null);setError("");};
  const card=(title:string,data:PrepaymentResult["shorten"],saved:number)=><section className="rounded-2xl border border-[#E1E6ED] bg-white p-4 dark:border-[#405064] dark:bg-[#1B2632]"><h3 className="font-semibold text-[#26364A] dark:text-[#F1F5F9]">{title}</h3><p className="mt-2 text-2xl font-bold tabular-nums text-[#E83C35]">{rub(saved)}</p><p className="text-xs text-[#748195]">Экономия на процентах</p><dl className="mt-4 space-y-2 text-sm"><Row label="Ежемесячный платёж" value={rub(data.monthlyPayment)}/><Row label="Срок после досрочного взноса" value={term(data.months)}/><Row label="Переплата по процентам" value={rub(data.interest)}/></dl></section>;
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-1 rounded-2xl border border-[#E4E8ED] bg-[#EEF1F5] p-1 dark:border-[#405064] dark:bg-[#111820]" role="tablist" aria-label="Режим досрочного погашения">
      {([{id:"quick",label:"Расчёт",Icon:Calculator},{id:"planner",label:"Подбор суммы",Icon:Target}] as const).map(item=><button key={item.id} type="button" role="tab" aria-selected={mode===item.id} onClick={()=>{setMode(item.id);setResult(null);setError("");setPicked(null);}} className={`min-h-12 rounded-xl px-2 py-2 text-sm font-semibold transition ${mode===item.id?"bg-white text-[#26364A] shadow-sm dark:bg-[#253241] dark:text-white":"text-[#748195]"}`}><item.Icon className="mx-auto mb-1 size-4"/><span>{item.label}</span></button>)}
    </div>
    <section className="rounded-3xl border border-[#E1E6ED] bg-white p-5 shadow-[0_4px_20px_#26364A05] dark:border-[#405064] dark:bg-[#1B2632] sm:p-7">
      <div className="mb-5"><h2 className="text-lg font-semibold text-[#26364A] dark:text-[#F1F5F9]">Параметры ипотеки</h2><p className="mt-1 text-sm text-[#748195]">Заполните известные данные - калькулятор сам выберет доступный вариант расчёта.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField className={inputClass} label="Текущий остаток долга, ₽" value={balance} onChange={v=>{setBalance(v);setResult(null);}} hint="Для быстрого расчёта. Если неизвестен - заполните данные ниже."/>
        <InputField money={false} maxValue={30} className={inputClass} label="Процентная ставка, % годовых" value={rate} onChange={v=>{setRate(v);setResult(null);}}/>
        <InputField className={inputClass} label="Ежемесячный платёж, ₽" value={payment} onChange={v=>{setPayment(v);setResult(null);}}/>
        <InputField className={inputClass} label="Первоначальная сумма кредита, ₽" value={principal} onChange={v=>{setPrincipal(v);setResult(null);}} hint="Дополнительные данные для подробного расчёта."/>
        <InputField money={false} className={inputClass} label="Дата оформления кредита" value={startDate} onChange={v=>{setStartDate(v);setResult(null);}} placeholder="ММ.ГГГГ" hint="Введите с клавиатуры, например 08.2020."/>
      </div>
      {mode!=="planner"?<><div className="mt-4"><InputField className={inputClass} label="Разовый досрочный взнос, ₽" value={extra} onChange={setExtra} hint="Например, 100 000 ₽ сейчас."/><InputField className={inputClass} label="Дополнительно каждый месяц, ₽" value={monthlyExtra} onChange={setMonthlyExtra} hint="Необязательно. Например, 5 000 ₽ ежемесячно."/></div><div className="mt-4"><button type="button" onClick={()=>setShowDetails(v=>!v)} className="text-sm font-semibold text-[#647184] dark:text-[#C5D0DC]">{showDetails?"Скрыть дополнительные параметры":"Дополнительные параметры расчёта"}</button>{showDetails&&<p className="mt-3 rounded-xl bg-[#F5F7FA] p-3 text-xs leading-relaxed text-[#647184] dark:bg-[#111820] dark:text-[#B8C4D2]">Для сравнения используется месячная ставка (годовая / 12). Сначала учитывается обычный платёж, затем досрочный взнос. Банк может рассчитывать проценты по фактическим дням между платежами.</p>}</div></>:<div className="mt-4 grid gap-4 sm:grid-cols-2"><GoalPicker value={goal} onChange={setGoal} className={inputClass}/><InputField money={goal==="payment"||goal==="interest"} className={inputClass} label={goal==="payment"?"Желаемый ежемесячный платёж, ₽":goal==="months"?"На сколько месяцев сократить срок":"Желаемая экономия, ₽"} value={target} onChange={setTarget}/></div>}
      {!balance.trim()&&principal.trim()&&startDate.trim()&&<p className="mt-3 rounded-xl bg-[#FFF7E8] p-3 text-xs leading-relaxed text-[#80642C] dark:bg-[#332D20] dark:text-[#E5D3A5]">Расчёт по первоначальной сумме предполагает, что раньше досрочных погашений не было. Если они были, укажите текущий остаток долга из банковского приложения - иначе оценка будет неточной.</p>}
      {error&&<p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={calculate} className="min-h-12 flex-1 rounded-xl bg-[#E83C35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#D9342E]">Рассчитать</button><button type="button" onClick={reset} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#DCE2E9] px-4 py-3 text-sm font-semibold text-[#647184] hover:bg-[#F5F7FA] dark:border-[#405064] dark:text-[#D5DEE8]"><RotateCcw className="size-4"/>Сбросить</button></div>
    </section>
    {result&&<section aria-live="polite" className="space-y-4"><div className="rounded-2xl border border-[#D9E4EF] bg-[#F5F8FC] p-4 dark:border-[#405064] dark:bg-[#111820]"><p className="text-sm font-semibold text-[#26364A] dark:text-[#E6ECF3]">Результат расчёта</p><p className="mt-1 text-xs font-medium text-[#748195]">{estimateInfo?"Подробный расчёт по параметрам кредита":"Быстрый расчёт по текущему остатку"}</p><p className="mt-1 text-sm text-[#647184] dark:text-[#B8C4D2]">Текущая переплата без досрочного погашения: {rub(result.baseline.interest)} · срок {term(result.baseline.months)}</p><p className="mt-1 text-sm text-[#647184] dark:text-[#B8C4D2]">Учтённый досрочный взнос: {rub(result.appliedExtra)}</p>{estimateInfo&&<p className="mt-1 text-sm text-[#647184] dark:text-[#B8C4D2]">Расчётный остаток по первоначальным данным: {rub(estimateInfo.balance)} · оплачено месяцев: {estimateInfo.monthsPaid}{balance.trim()?" · введённый остаток: "+rub(parse(balance)):""}</p>}{picked!==null&&<p className="mt-2 text-lg font-bold text-[#E83C35]">Рекомендуемая сумма досрочного погашения: <span className="whitespace-nowrap">{rub(picked)}</span></p>}</div><div className="grid gap-4 lg:grid-cols-2">{card("1. Сократить срок",result.shorten,Math.max(0,result.baseline.interest-result.shorten.interest))}{card("2. Уменьшить платёж",result.reduce,Math.max(0,result.baseline.interest-result.reduce.interest))}</div><p className="w-full rounded-xl bg-[#F5F7FA] px-4 py-3 text-xs leading-relaxed text-[#748195] dark:bg-[#111820] dark:text-[#B8C4D2]">Ориентировочный расчёт, не банковский график. Фактический остаток и переплата могут отличаться из-за изменения ставки, кредитных каникул и досрочных погашений.</p></section>}
  </div>;
}

function GoalPicker({value,onChange,className}:{value:PlannerGoal;onChange:(v:PlannerGoal)=>void;className:string}){
 const [open,setOpen]=useState(false);
 const options:[PlannerGoal,string][]=[["payment","Снизить ежемесячный платёж"],["months","Сократить срок кредита"],["interest","Сэкономить на процентах"]];
 const selected=options.find(([v])=>v===value)?.[1]??options[0][1];
 return <div className="relative"><span className="mb-2 block text-sm font-semibold text-[#596779] dark:text-[#D5DEE8]">Желаемый результат</span><button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className={`${className} flex items-center justify-between gap-3 text-left`}><span>{selected}</span><span className="text-[#7B8797]">⌄</span></button>{open&&<div role="listbox" aria-label="Желаемый результат" className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-[#DCE2E9] bg-white p-1 shadow-xl dark:border-[#405064] dark:bg-[#1B2632]">{options.map(([v,label])=><button key={v} type="button" role="option" aria-selected={value===v} onClick={()=>{onChange(v);setOpen(false);}} className={`block w-full rounded-lg px-3 py-3 text-left text-sm ${value===v?"bg-[#FCEBEA] font-semibold text-[#C8322B] dark:bg-[#352322] dark:text-[#FF9B94]":"text-[#26364A] hover:bg-[#F5F7FA] dark:text-[#E6ECF3] dark:hover:bg-[#253241]"}`}>{label}</button>)}</div>}</div>;
}

function InputField({label,value,onChange,type="text",hint,className,money=true,maxValue,placeholder}:{label:string;value:string;onChange:(v:string)=>void;type?:"text"|"date"|"month";hint?:string;className:string;money?:boolean;maxValue?:number;placeholder?:string}){
  const ref=useRef<HTMLInputElement>(null);
  const cursor=useRef<number|null>(null);
  const [,render]=useState(0);
  useLayoutEffect(()=>{if(cursor.current!==null){ref.current?.setSelectionRange(cursor.current,cursor.current);cursor.current=null;}});
  const numeric=type==="text";
  return <div className="min-w-0"><label className="mb-2 block text-sm font-semibold text-[#596779] dark:text-[#D5DEE8]">{label}</label><div className="relative">
    <input ref={ref} type={type} value={value} inputMode={numeric?"decimal":undefined} autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="next" autoComplete="off" placeholder={placeholder} onFocus={e=>scrollFocusedInputIntoView(e.currentTarget)} onClick={e=>scrollFocusedInputIntoView(e.currentTarget)} onKeyDown={e=>{if(e.key==="-"||e.key==="−"||e.key==="Subtract")e.preventDefault();if(e.key==="Enter"&&!e.nativeEvent.isComposing){e.preventDefault();focusNextCalculatorInput(e.currentTarget);}}} onChange={e=>{
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
function Row({label,value}:{label:string;value:string}){return <div className="flex flex-wrap justify-between gap-2"><dt className="text-[#647184] dark:text-[#B8C4D2]">{label}</dt><dd className="whitespace-nowrap font-semibold tabular-nums text-[#26364A] dark:text-[#F1F5F9]">{value}</dd></div>;}
