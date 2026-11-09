"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { focusNextCalculatorInput, handleFormattedBackspace } from "@/lib/calculator-input";
import { formatInput } from "@/lib/calculator";
import { scrollFocusedInputIntoView } from "@/lib/scroll-focused-input";
import { Calculator, Wallet, RotateCcw } from "lucide-react";
import { calculatePlanOptions, calculatePrepayment, type PrepaymentResult, type PlanOptions } from "@/lib/prepayment";
const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const rub = (v: number) => `${money.format(v)}\u00a0₽`;
const plural = (n:number,one:string,few:string,many:string) => { const n10=n%10,n100=n%100; return n100>=11&&n100<=14?many:n10===1?one:n10>=2&&n10<=4?few:many; };
const term = (months:number) => { const years=Math.floor(months/12), rest=months%12; return years?`${years} ${plural(years,"год","года","лет")}${rest?` ${rest} ${plural(rest,"месяц","месяца","месяцев")}`:""}`:`${months} ${plural(months,"месяц","месяца","месяцев")}`; };
const parse = (v: string) => { const n = v.replace(/[\s\u00a0\u202f]/g, "").replace(",", "."); return /^\d+(?:\.\d+)?$/.test(n) ? Number(n) : NaN; };
type Mode = "quick" | "planner";
export function PrepaymentCalculator() {
  const [mode,setMode]=useState<Mode>("quick");
  const [balance,setBalance]=useState("");
  const [rate,setRate]=useState(""), [payment,setPayment]=useState(""), [extra,setExtra]=useState(""), [monthlyExtra,setMonthlyExtra]=useState("");
  const [manualExtra,setManualExtra]=useState("");
  const [result,setResult]=useState<PrepaymentResult|null>(null), [planOptions,setPlanOptions]=useState<PlanOptions|null>(null), [picked,setPicked]=useState<number|null>(null), [error,setError]=useState(""), [showDetails,setShowDetails]=useState(false), [showLoanDetails,setShowLoanDetails]=useState(false);
  const inputClass="mt-2 h-14 w-full rounded-xl border border-[#E4E8ED] bg-[#F7F8FA] px-4 text-base font-medium tabular-nums text-[#26364A] outline-none transition placeholder:text-sm placeholder:font-normal placeholder:text-[#8993A2] focus:border-[#E83C35] focus:ring-4 focus:ring-[#E83C35]/10 dark:border-[#405064] dark:bg-[#111820] dark:text-[#E6ECF3]";

  const calculate=()=>{try{
    setError("");setPlanOptions(null);
    const current=parse(balance);
    const base={balance:current,monthlyPayment:parse(payment),annualRate:parse(rate)};
    if(mode==="planner"){if(!manualExtra.trim())throw new Error("Укажите сумму, которую клиент готов внести досрочно.");const amount=parse(manualExtra);setPicked(null);setResult(calculatePrepayment({...base,extraPayment:amount}));}
    else{setPicked(null);setResult(calculatePrepayment({...base,extraPayment:extra.trim()?parse(extra):0}));setPlanOptions(calculatePlanOptions({...base,lumpSum:extra.trim()?parse(extra):0,monthlyExtra:monthlyExtra.trim()?parse(monthlyExtra):0}));}
  }catch(e){setResult(null);setPlanOptions(null);setPicked(null);setError(e instanceof Error?e.message:"Не удалось выполнить расчёт.");}};
  const reset=()=>{setBalance("");setRate("");setPayment("");setExtra("");setMonthlyExtra("");setManualExtra("");setResult(null);setPlanOptions(null);setPicked(null);setError("");};
  const card=(title:string,data:PrepaymentResult["shorten"],saved:number,baselineMonths:number)=><section className="rounded-2xl border border-[#E1E6ED] bg-white p-4 dark:border-[#405064] dark:bg-[#1B2632]"><h3 className="font-semibold text-[#26364A] dark:text-[#F1F5F9]">{title}</h3><p className="mt-2 text-2xl font-bold tabular-nums text-[#E83C35]">{rub(saved)}</p><p className="text-xs text-[#748195]">Экономия на процентах</p><dl className="mt-4 space-y-2 text-sm"><Row label="Обязательный ежемесячный платёж" value={rub(data.monthlyPayment)}/><Row label="Остаток срока без досрочных взносов" value={term(baselineMonths)}/><Row label="Остаток срока после досрочного взноса" value={term(data.months)}/><Row label="Срок сокращён на" value={term(Math.max(0,baselineMonths-data.months))}/><Row label="Переплата по процентам" value={rub(data.interest)}/></dl></section>;
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-1 rounded-2xl border border-[#E4E8ED] bg-[#EEF1F5] p-1 dark:border-[#405064] dark:bg-[#111820]" role="tablist" aria-label="Режим досрочного погашения">
      {([{id:"quick",label:"Сравнение вариантов",Icon:Calculator},{id:"planner",label:"Моя сумма",Icon:Wallet}] as const).map(item=><button key={item.id} type="button" role="tab" aria-selected={mode===item.id} onClick={()=>{setMode(item.id);setResult(null);setError("");setPicked(null);}} className={`min-h-12 rounded-xl px-2 py-2 text-sm font-semibold transition ${mode===item.id?"bg-white text-[#26364A] shadow-sm dark:bg-[#253241] dark:text-white":"text-[#748195]"}`}><item.Icon className="mx-auto mb-1 size-4"/><span>{item.label}</span></button>)}
    </div>
    <section className="rounded-3xl border border-[#E1E6ED] bg-white p-5 shadow-[0_4px_20px_#26364A05] dark:border-[#405064] dark:bg-[#1B2632] sm:p-7">
      <div className="mb-5"><h2 className="text-lg font-semibold text-[#26364A] dark:text-[#F1F5F9]">Параметры ипотеки</h2><p className="mt-1 text-sm text-[#748195]">Заполните известные данные - калькулятор сам выберет доступный вариант расчёта.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InputField className={inputClass} label="Остаток долга, ₽" maxDigits={9} value={balance} onChange={v=>{setBalance(v);setResult(null);}}/>
        <InputField className={inputClass} label="Ежемесячный платёж, ₽" maxDigits={7} value={payment} onChange={v=>{setPayment(v);setResult(null);}}/>
        <div className="sm:col-span-2 lg:col-span-1"><InputField money={false} maxValue={30} maxIntegerDigits={2} maxFractionDigits={2} className={inputClass} label="Ставка, %" value={rate} onChange={v=>{setRate(v);setResult(null);}}/></div>
      </div>
      {mode!=="planner"?<><div className="mt-4 grid gap-4 sm:grid-cols-2"><InputField className={inputClass} label="Ежемесячный досрочный платёж, ₽" maxDigits={7} value={monthlyExtra} onChange={v=>{setMonthlyExtra(v);setResult(null);setPlanOptions(null);}}/><InputField className={inputClass} label="Разовый досрочный платёж, ₽" maxDigits={7} value={extra} onChange={v=>{setExtra(v);setResult(null);setPlanOptions(null);}}/></div>{payment.trim()&&Number.isFinite(parse(payment))&&parse(payment)>0&&<p className="mt-3 text-xs leading-relaxed text-[#748195] dark:text-[#B8C4D2]"><span className="block">Текущий платёж {rub(parse(payment))} сохраняется.</span><span className="block">Досрочные взносы вносятся сверх него.</span></p>}<div className="mt-4"><button type="button" onClick={()=>setShowDetails(v=>!v)} className="text-sm font-semibold text-[#647184] dark:text-[#C5D0DC]">{showDetails?"Скрыть":"Методика и этапы расчёта"}</button>{showDetails&&<div className="mt-3 rounded-xl bg-[#F5F7FA] p-3 text-xs leading-relaxed text-[#647184] dark:bg-[#111820] dark:text-[#B8C4D2]"><p className="font-semibold text-[#526174] dark:text-[#D5DEE8]">Расчёт выполняется по помесячной модели:</p><ol className="mt-2 list-decimal space-y-1 pl-5"><li>Рассчитывается базовый график погашения без досрочных взносов.</li><li>Определяется сумма процентов, начисляемых за каждый расчётный месяц.</li><li>Учитывается погашение основного долга обязательным платежом и досрочными взносами.</li><li>Моделируется изменение остатка задолженности и пересчитываются параметры платежей в зависимости от выбранного сценария.</li><li>Рассчитываются срок полного погашения и общая сумма уплаченных процентов.</li><li>Сценарии сравниваются с базовым графиком для определения экономии.</li></ol></div>}</div></>:<div className="mt-4"><InputField className={inputClass} label="Сумма досрочного погашения, ₽" maxDigits={7} value={manualExtra} onChange={v=>{setManualExtra(v);setResult(null);}} hint="Введите сумму, которую клиент готов внести. Покажем, на сколько сократится ипотека и сколько процентов удастся сэкономить."/></div>}
      {error&&<p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={calculate} className="min-h-12 flex-1 rounded-xl bg-[#E83C35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#D9342E]">Рассчитать</button><button type="button" onClick={reset} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#DCE2E9] px-4 py-3 text-sm font-semibold text-[#647184] hover:bg-[#F5F7FA] dark:border-[#405064] dark:text-[#D5DEE8]"><RotateCcw className="size-4"/>Сбросить</button></div>
    </section>
    {planOptions&&mode!=="planner"&&<section className="space-y-3" aria-live="polite"><div className="grid gap-3 lg:grid-cols-2">{([["lumpShorten","Сокращение срока",planOptions.lumpShorten],["lumpReduce","Уменьшение платежа",planOptions.lumpReduce],["recurringShorten","Регулярные взносы",planOptions.recurringShorten]] as const).map(([key,title,d])=>{const saving=Math.max(0,planOptions.baseline.interest-d.interest);const reduction=Math.max(0,planOptions.baseline.months-d.months);const recommended=planOptions.recommendation===key;return <div key={key} className={`rounded-2xl border p-4 dark:bg-[#1B2632] ${recommended?"border-[#E83C35] bg-[#FFF8F7] dark:border-[#E83C35]":"border-[#E1E6ED] bg-white dark:border-[#405064]"}`}><h3 className="font-semibold text-[#26364A] dark:text-[#F1F5F9]">{title}</h3>{recommended&&<p className="mt-2 text-sm font-bold text-[#E83C35]">Рекомендуем {key==="lumpShorten"?"сократить срок ипотеки":key==="lumpReduce"?"уменьшить ежемесячный платёж":`вносить дополнительно ${rub(d.monthlyExtra)} каждый месяц`}.</p>}{key==="lumpShorten"&&<p className="mt-2 text-sm leading-relaxed text-[#526174] dark:text-[#C5D0DC]">Экономия {rub(saving)} на процентах, сокращение срока кредита на {term(reduction)}. Ежемесячный платёж останется прежним.</p>}{key==="lumpReduce"&&<p className="mt-2 text-sm leading-relaxed text-[#526174] dark:text-[#C5D0DC]">{d.requiredPayment===0?"Кредит будет полностью погашен первым досрочным взносом.":`Платёж снизится с ${rub(planOptions.baseline.monthlyPayment)} до ${rub(d.requiredPayment)}.`} Экономия {rub(saving)} на процентах.</p>}{key==="recurringShorten"&&<p className="mt-2 text-sm leading-relaxed text-[#526174] dark:text-[#C5D0DC]">Это позволит сократить срок ипотеки на {term(reduction)} и сэкономить {rub(saving)}.</p>}<dl className="mt-3 space-y-2 text-sm"><Row label="Обязательный ежемесячный платёж" value={rub(d.requiredPayment)}/>{d.monthlyExtra>0&&<Row label="Досрочный взнос ежемесячно" value={rub(d.monthlyExtra)}/>}<Row label="Общая сумма ежемесячных выплат" value={rub(d.totalMonthlyOutflow)}/><Row label="Остаток срока без досрочных взносов" value={term(planOptions.baseline.months)}/><Row label="Остаток срока с выбранным сценарием" value={term(d.months)}/><Row label="Срок сокращён на" value={term(reduction)}/></dl></div>;})}</div></section>}
    {result&&<section aria-live="polite" className="space-y-4"><div className="rounded-2xl border border-[#D9E4EF] bg-[#F5F8FC] p-4 dark:border-[#405064] dark:bg-[#111820]"><p className="text-sm font-semibold text-[#26364A] dark:text-[#E6ECF3]">Результат расчёта</p><p className="mt-1 text-xs font-medium text-[#748195]">"Расчёт по текущему остатку"</p><p className="mt-1 text-sm text-[#647184] dark:text-[#B8C4D2]">Текущая переплата без досрочного погашения: {rub(result.baseline.interest)} · срок {term(result.baseline.months)}</p><p className="mt-1 text-sm text-[#647184] dark:text-[#B8C4D2]">Учтённый досрочный взнос: {rub(result.appliedExtra)}</p>{picked!==null&&<p className="mt-2 text-lg font-bold text-[#E83C35]">Рекомендуемая сумма досрочного погашения: <span className="whitespace-nowrap">{rub(picked)}</span></p>}</div><div className="grid gap-4 lg:grid-cols-2">{card("Сократить срок кредита",result.shorten,Math.max(0,result.baseline.interest-result.shorten.interest),result.baseline.months)}{mode!=="planner"&&card("Уменьшить ежемесячный платёж",result.reduce,Math.max(0,result.baseline.interest-result.reduce.interest),result.baseline.months)}</div></section>}
    {(result||planOptions)&&<p className="rounded-xl border border-[#E1E6ED] bg-white px-4 py-3 text-xs leading-relaxed text-[#748195] dark:border-[#405064] dark:bg-[#1B2632] dark:text-[#B8C4D2]">Расчёт предварительный. Банковский график может отличаться из-за фактических дат платежей, количества дней в процентном периоде и правил банка.</p>}

  </div>;
}

function InputField({label,value,onChange,type="text",hint,className,money=true,maxValue,maxDigits,maxIntegerDigits,maxFractionDigits,placeholder}:{label:string;value:string;onChange:(v:string)=>void;type?:"text"|"date"|"month";hint?:string;className:string;money?:boolean;maxValue?:number;maxDigits?:number;maxIntegerDigits?:number;maxFractionDigits?:number;placeholder?:string}){
  const ref=useRef<HTMLInputElement>(null);
  const cursor=useRef<number|null>(null);
  const [,render]=useState(0);
  useLayoutEffect(()=>{if(cursor.current!==null){ref.current?.setSelectionRange(cursor.current,cursor.current);cursor.current=null;}});
  const numeric=type==="text";
  return <div className="min-w-0"><label className="mb-2 block text-sm font-semibold text-[#596779] dark:text-[#D5DEE8]">{label}</label><div className="relative">
    <input ref={ref} type={type} value={value} inputMode={numeric?"decimal":undefined} autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="next" autoComplete="off" placeholder={placeholder} onFocus={e=>scrollFocusedInputIntoView(e.currentTarget)} onClick={e=>scrollFocusedInputIntoView(e.currentTarget)} onKeyDown={e=>{if(money&&handleFormattedBackspace(e,onChange))return;if(e.key==="-"||e.key==="−"||e.key==="Subtract")e.preventDefault();if(e.key==="Enter"&&!e.nativeEvent.isComposing){e.preventDefault();focusNextCalculatorInput(e.currentTarget);}}} onChange={e=>{
      if(!numeric){onChange(e.target.value);return;}
      const raw=e.target.value.replace(/[^\d.,]/g,"").replace(/([.,].*)[.,]/g,"$1");
      const digits=raw.replace(/[\s\u00a0\u202f]/g,"").split(/[.,]/)[0].replace(/^0+/,"");
      if(money&&digits.length>(maxDigits??10))return;
      const position=e.target.selectionStart??raw.length;
      const significant=raw.slice(0,position).replace(/[\s\u00a0\u202f]/g,"").length;
      const normalized=raw.replace(",",".");
      const candidateParts=normalized.split(".");
      const candidate=candidateParts.length>2?candidateParts[0]+"."+candidateParts.slice(1).join(""):normalized;
      const integerDigits=(candidateParts[0]??"").replace(/\D/g,"").replace(/^0+/,"");
      const fractionDigits=candidateParts[1]??"";
      if(!money&&maxIntegerDigits!==undefined&&integerDigits.length>maxIntegerDigits)return;
      if(!money&&maxFractionDigits!==undefined&&fractionDigits.length>maxFractionDigits)return;
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
