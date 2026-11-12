"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Delete, X } from "lucide-react";
import { evaluateQuickExpression, formatQuickExpression } from "@/lib/quick-calculator";

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
  const expressionInputRef = useRef<HTMLInputElement>(null);
  const pendingCaretRef = useRef<number | null>(null);

  const commitExpression = (next: string, caret: number) => {
    setExpression(next);
    pendingCaretRef.current = caret;
    setResult("");
    setError("");
    setJustEvaluated(false);
  };

  useLayoutEffect(() => {
    if (pendingCaretRef.current === null) return;
    const input = expressionInputRef.current;
    if (!input) return;
    const rawCaret = pendingCaretRef.current;
    const visibleCaret = formatQuickExpression(expression.slice(0, rawCaret)).length;
    input.focus();
    input.setSelectionRange(visibleCaret, visibleCaret);
    pendingCaretRef.current = null;
  }, [expression]);

  const append = (key: string) => {
    setError("");
    if (key === "AC") { setExpression("0"); setResult(""); setJustEvaluated(false); return; }
    const input = expressionInputRef.current;
    const visible = input?.value ?? formatQuickExpression(expression);
    const visibleStart = input?.selectionStart ?? visible.length;
    const visibleEnd = input?.selectionEnd ?? visibleStart;
    const start = visible.slice(0, visibleStart).replace(/[ \\u00a0\\u202f]/g, "").length;
    const end = visible.slice(0, visibleEnd).replace(/[ \\u00a0\\u202f]/g, "").length;
    const replaceSelection = (value: string) => {
      const next = expression.slice(0, start) + value + expression.slice(end);
      commitExpression(next || "0", start + value.length);
    };
    if (key === "⌫") {
      if (start !== end) replaceSelection("");
      else if (start > 0) {
        const from = start - 1;
        const next = expression.slice(0, from) + expression.slice(start);
        commitExpression(next || "0", from);
      }
      return;
    }
    if (key === "=") {
      try {
        const value = evaluateQuickExpression(expression);
        setResult(pretty(value)); setExpression(String(value).replace(".", ",")); setJustEvaluated(true);
      } catch (caught) { setError(caught instanceof Error ? caught.message : "Ошибка"); }
      return;
    }
    if (key === "(" || key === ")") {
      replaceSelection(key);
      return;
    }
    if (key === "±") {
      setExpression(current => {
        const match = current.match(/(\d+(?:[.,]\d*)?|[.,]\d+)$/);
        if (!match || match.index === undefined) return current;
        const start = match.index;
        const before = current.slice(0, start);
        const number = match[0];
        const hasUnaryMinus = before.endsWith("−") && (before.length === 1 || /[+−×÷(]$/.test(before.slice(0, -1)));
        return hasUnaryMinus ? before.slice(0, -1) + number : before + "−" + number;
      });
      setResult(""); setJustEvaluated(false); return;
    }
    if (justEvaluated && !operators.includes(key) && key !== "%") {
      setExpression("0");
      pendingCaretRef.current = 1;
      setJustEvaluated(false);
      if (/^[0-9]$/.test(key) || key === ",") {
        commitExpression(key === "," ? "0," : key, key === "," ? 2 : 1);
        return;
      }
    }
    if (key === ",") {
      const currentNumber = expression.slice(0, start).split(/[+−×÷()%]/).pop() ?? "";
      if (currentNumber.includes(",") || currentNumber.includes(".")) return;
      replaceSelection(",");
      return;
    }
    if (operators.includes(key) && start === end && start > 0 && /[+−×÷]$/.test(expression.slice(0, start))) {
      const next = expression.slice(0, start - 1) + key + expression.slice(end);
      commitExpression(next, start);
      return;
    }
    replaceSelection(key);
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
        <h2 id="quick-calculator-title" className="text-sm font-semibold text-[#26364A] dark:text-[#E6ECF3]">Калькулятор</h2>
        <button type="button" onClick={onClose} aria-label="Закрыть калькулятор" className="flex size-9 items-center justify-center rounded-xl text-[#748195] hover:bg-[#F1F3F6] dark:hover:bg-[#253241]"><X className="size-5" /></button>
      </header>
      <div className="px-5 pb-3 pt-5">
        <div className="flex min-h-[156px] flex-col items-end justify-end overflow-hidden rounded-2xl bg-[#F4F6F8] px-4 py-4 text-right dark:bg-[#111820]">
          <input
            ref={expressionInputRef}
            aria-label="Математическое выражение"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={formatQuickExpression(expression)}
            onChange={event => {
              const value = event.target.value;
              const raw = value.replace(/[ \\u00a0\\u202f]/g, "");
              const rawCaret = value.slice(0, event.target.selectionStart ?? value.length).replace(/[ \\u00a0\\u202f]/g, "").length;
              setExpression(raw || "0");
              pendingCaretRef.current = rawCaret;
              setResult("");
              setError("");
              setJustEvaluated(false);
            }}
            onMouseDown={event => event.stopPropagation()}
            className="w-full min-w-0 bg-transparent text-right text-lg text-[#748195] outline-none"
          />
          <p className="mt-1 max-w-full break-all text-[48px] font-semibold leading-tight tracking-tight tabular-nums sm:text-[52px] text-[#26364A] dark:text-[#E6ECF3]">{error || result || " "}</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 px-5 pb-2">
        {["(", ")"].map(key => <button key={key} type="button" onMouseDown={event => event.preventDefault()} onClick={() => append(key)} aria-label={key === "(" ? "Открывающая скобка" : "Закрывающая скобка"} className="flex min-h-10 min-w-14 items-center justify-center rounded-xl bg-[#EAF0F6] px-4 text-lg font-semibold text-[#26364A] transition hover:bg-[#DDE5EE] active:scale-[.97] dark:bg-[#253241] dark:text-[#E6ECF3]">{key}</button>)}
      </div>
      <div className="grid grid-cols-4 gap-2 px-5 pb-5">
        {keys.map(key => {
          const utility = ["AC", "±", "%", "⌫"].includes(key);
          const operator = operators.includes(key) || key === "÷" || key === "=";
          return <button key={key} type="button" onMouseDown={event => event.preventDefault()} onClick={() => append(key)} aria-label={key === "⌫" ? "Удалить последнюю цифру" : key} className={`flex min-h-[58px] items-center justify-center rounded-2xl text-xl font-semibold tabular-nums transition active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E83C35] ${key === "=" ? "bg-[#E83C35] text-white hover:bg-[#D9322C]" : operator ? "bg-[#26364A] text-white hover:bg-[#34465D] dark:bg-[#34465D]" : utility ? "bg-[#FCEBEA] text-[#A94442] hover:bg-[#F8DDDB] dark:bg-[#352322] dark:text-[#F0A5A0]" : "bg-[#F1F3F6] text-[#26364A] hover:bg-[#E7EBF0] dark:bg-[#253241] dark:text-[#E6ECF3]"} ${key === "0" ? "col-span-1" : ""}`}>{key === "⌫" ? <Delete className="size-5" /> : key}</button>;
        })}
      </div>
    </section>
  </div>;
}
