"use client";

import { useEffect, useRef, useState } from "react";
import { Delete, X } from "lucide-react";
import { evaluateQuickExpression } from "@/lib/quick-calculator";

const keys = ["AC", "±", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ",", "=", "⌫"];
const operators = ["+", "−", "×", "÷"];

function pretty(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 10, useGrouping: true }).format(value);
}

export function QuickCalculator({ onClose }: { onClose: () => void }) {
  const [expression, setExpression] = useState("0");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [justEvaluated, setJustEvaluated] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const append = (key: string) => {
    setError("");
    if (key === "AC") { setExpression("0"); setResult(""); setJustEvaluated(false); return; }
    if (key === "⌫") {
      setExpression(current => current.length <= 1 ? "0" : current.slice(0, -1));
      setResult(""); setJustEvaluated(false); return;
    }
    if (key === "=") {
      try {
        const value = evaluateQuickExpression(expression);
        setResult(pretty(value)); setExpression(String(value).replace(".", ",")); setJustEvaluated(true);
      } catch (caught) { setError(caught instanceof Error ? caught.message : "Ошибка"); }
      return;
    }
    if (key === "(" || key === ")") {
      setExpression(current => (current === "0" || justEvaluated ? key : current + key));
      setResult(""); setJustEvaluated(false); return;
    }
    if (key === "±") {
      setExpression(current => {
        if (current === "0") return current;
        const match = current.match(/(\\d+(?:[.,]\\d*)?|[.,]\\d+)$/);
        if (!match || match.index === undefined) return current.startsWith("-") ? current.slice(1) : "-" + current;
        const start = match.index;
        const before = current.slice(0, start);
        const number = match[0];
        return /[+−×÷(]$/.test(before) ? before + "-" + number : before + (before.endsWith("-") ? "+" : "−") + number;
      });
      setResult(""); setJustEvaluated(false); return;
    }
    setExpression(current => {
      if (justEvaluated && !operators.includes(key) && key !== "%") current = "0";
      if (key === ",") {
        const lastNumber = current.split(/[+−×÷()%]/).pop() ?? "";
        if (lastNumber.includes(",") || lastNumber.includes(".")) return current;
        return current === "0" ? "0," : current + ",";
      }
      if (operators.includes(key)) {
        if (current === "0" && key !== "−") return current;
        if (/[+−×÷]$/.test(current)) return current.slice(0, -1) + key;
      }
      return current === "0" && /[0-9]/.test(key) ? key : current + key;
    });
    setResult(""); setJustEvaluated(false);
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (/^[0-9]$/.test(event.key)) { event.preventDefault(); append(event.key); }
      else if (event.key === "." || event.key === ",") { event.preventDefault(); append(","); }
      else if (event.key === "+") { event.preventDefault(); append("+"); }
      else if (event.key === "-") { event.preventDefault(); append("−"); }
      else if (event.key === "*") { event.preventDefault(); append("×"); }
      else if (event.key === "/") { event.preventDefault(); append("÷"); }
      else if (event.key === "%") { event.preventDefault(); append("%"); }
      else if (event.key === "(" || event.key === ")") { event.preventDefault(); append(event.key); }
      else if (event.key === "Enter" || event.key === "=") { event.preventDefault(); append("="); }
      else if (event.key === "Backspace") { event.preventDefault(); append("⌫"); }
      else if (event.key === "Delete") { event.preventDefault(); append("AC"); }
    };
    window.addEventListener("keydown", handleKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", handleKey);
  });

  return <div className="fixed inset-0 z-[100] flex items-start justify-center bg-[#17212D]/45 px-4 pb-6 pt-[max(5rem,env(safe-area-inset-top))] backdrop-blur-[2px]" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="quick-calculator-title" tabIndex={-1} className="w-full max-w-[360px] overflow-hidden rounded-3xl border border-[#E1E6ED] bg-white shadow-2xl outline-none dark:border-[#405064] dark:bg-[#1B2632]">
      <header className="flex items-center justify-between border-b border-[#E7EBF0] px-5 py-4 dark:border-[#354354]">
        <h2 id="quick-calculator-title" className="text-base font-semibold text-[#26364A] dark:text-[#E6ECF3]">Калькулятор</h2>
        <button type="button" onClick={onClose} aria-label="Закрыть калькулятор" className="flex size-9 items-center justify-center rounded-xl text-[#748195] hover:bg-[#F1F3F6] dark:hover:bg-[#253241]"><X className="size-5" /></button>
      </header>
      <div className="px-5 pb-3 pt-5">
        <div className="flex min-h-[132px] flex-col items-end justify-end overflow-hidden rounded-2xl bg-[#F4F6F8] px-4 py-3 text-right dark:bg-[#111820]">
          <p className="max-w-full break-all text-sm text-[#748195]" aria-live="polite">{expression}</p>
          <p className="mt-1 max-w-full break-all text-[42px] font-semibold leading-tight tracking-tight tabular-nums sm:text-[46px] text-[#26364A] dark:text-[#E6ECF3]">{error || result || " "}</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 px-5 pb-2">
        {["(", ")"].map(key => <button key={key} type="button" onClick={() => append(key)} aria-label={key === "(" ? "Открывающая скобка" : "Закрывающая скобка"} className="flex min-h-10 min-w-14 items-center justify-center rounded-xl bg-[#EAF0F6] px-4 text-lg font-semibold text-[#26364A] transition hover:bg-[#DDE5EE] active:scale-[.97] dark:bg-[#253241] dark:text-[#E6ECF3]">{key}</button>)}
      </div>
      <div className="grid grid-cols-4 gap-2 px-5 pb-5">
        {keys.map(key => {
          const utility = ["AC", "±", "%", "⌫"].includes(key);
          const operator = operators.includes(key) || key === "÷" || key === "=";
          return <button key={key} type="button" onClick={() => append(key)} aria-label={key === "⌫" ? "Удалить последнюю цифру" : key} className={`flex min-h-[58px] items-center justify-center rounded-2xl text-xl font-semibold tabular-nums transition active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E83C35] ${key === "=" ? "bg-[#E83C35] text-white hover:bg-[#D9322C]" : operator ? "bg-[#26364A] text-white hover:bg-[#34465D] dark:bg-[#34465D]" : utility ? "bg-[#FCEBEA] text-[#A94442] hover:bg-[#F8DDDB] dark:bg-[#352322] dark:text-[#F0A5A0]" : "bg-[#F1F3F6] text-[#26364A] hover:bg-[#E7EBF0] dark:bg-[#253241] dark:text-[#E6ECF3]"} ${key === "0" ? "col-span-1" : ""}`}>{key === "⌫" ? <Delete className="size-5" /> : key}</button>;
        })}
      </div>
      <p className="px-5 pb-4 text-center text-[11px] text-[#8993A2]">Можно вводить выражения с клавиатуры</p>
    </section>
  </div>;
}
