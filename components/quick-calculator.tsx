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
  const [expression, setExpression] = useState("");
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
    if (key === "AC") { setExpression(""); setResult(""); setJustEvaluated(false); return; }
    const input = expressionInputRef.current;
    const visible = input?.value ?? formatQuickExpression(expression || "0");
    const visibleStart = input?.selectionStart ?? visible.length;
    const visibleEnd = input?.selectionEnd ?? visibleStart;
    const start = expression ? visible.slice(0, visibleStart).replace(/[ \u00a0\u202f]/g, "").length : 0;
    const end = expression ? visible.slice(0, visibleEnd).replace(/[ \u00a0\u202f]/g, "").length : 0;
    const replaceSelection = (value: string) => {
      let from = start;
      let to = end;
      if (/^\d$/.test(value) && from === to) {
        let tokenStart = from;
        let tokenEnd = from;
        while (tokenStart > 0 && !/[+−×÷()%]/.test(expression[tokenStart - 1])) tokenStart--;
        while (tokenEnd < expression.length && !/[+−×÷()%]/.test(expression[tokenEnd])) tokenEnd++;
        if (expression.slice(tokenStart, tokenEnd) === "0" && from === tokenEnd) {
          from = tokenStart;
          to = tokenEnd;
        }
      }
      const next = expression.slice(0, from) + value + expression.slice(to);
      commitExpression(next, from + value.length);
    };
    if (key === "⌫") {
      if (start !== end) replaceSelection("");
      else if (start > 0) {
        const from = start - 1;
        const next = expression.slice(0, from) + expression.slice(start);
        commitExpression(next, from);
      }
      return;
    }
    if (key === "=") {
      try {
        const value = evaluateQuickExpression(expression || "0");
        const normalizedResult = String(value).replace(".", ",");
        setResult(pretty(value));
        setExpression(normalizedResult);
        pendingCaretRef.current = normalizedResult.length;
        setJustEvaluated(true);
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
      let tokenStart = start;
      let tokenEnd = start;
      while (tokenStart > 0 && !/[+−×÷()%]/.test(expression[tokenStart - 1])) tokenStart--;
      while (tokenEnd < expression.length && !/[+−×÷()%]/.test(expression[tokenEnd])) tokenEnd++;
      const currentNumber = expression.slice(tokenStart, tokenEnd);
      if (currentNumber.includes(",") || currentNumber.includes(".")) return;
      if (!currentNumber) {
        const next = expression.slice(0, start) + "0," + expression.slice(end);
        commitExpression(next, start + 2);
      } else {
        replaceSelection(",");
      }
      return;
    }
    if (operators.includes(key)) {
      const before = expression.slice(0, start);
      const after = expression.slice(end);
      const previous = before.slice(-1);
      const nextChar = after[0];
      // Binary operators need a left operand. Only unary minus may begin a term.
      if (!before && key !== "−") return;
      if (/[+×÷]/.test(key) && (previous === "(" || !previous)) return;
      if (/[×÷]/.test(key) && /[+−×÷(]$/.test(before)) return;
      if (key === "−" && previous === "−" && start === end) return;
      if (start === end && /[+−×÷]$/.test(before)) {
        const next = before.slice(0, -1) + key + after;
        commitExpression(next, start);
        return;
      }
      if (start === end && nextChar && /[+−×÷]/.test(nextChar)) {
        const next = before + key + after.slice(1);
        commitExpression(next, start + 1);
        return;
      }
    }
    if (key === "%" && (start === 0 || !/[0-9),]$/.test(expression.slice(0, start)) || expression[start - 1] === "%")) return;
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
        <h2 id="quick-calculator-title" className="text-base font-semibold text-[#26364A] dark:text-[#E6ECF3]">Калькулятор</h2>
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
            value={formatQuickExpression(expression || "0")}
            onChange={event => {
              const value = event.target.value.replace(/[ \u00a0\u202f]/g, "");
              const caret = (event.target.selectionStart ?? value.length);
              const acceptedBeforeCaret = value.slice(0, caret);
              const normalize = (source: string): string | null => {
                let output = "";
                let decimalUsed = false;
                for (const char of source) {
                  if (/^[0-9]$/.test(char)) {
                    output += char;
                  } else if (/[+−×÷%()]/.test(char)) {
                    output += char;
                    decimalUsed = false;
                  } else if (char === "," || char === ".") {
                    if (decimalUsed) return null;
                    output += ",";
                    decimalUsed = true;
                  } else {
                    return null;
                  }
                }
                return output;
              };
              const raw = normalize(value);
              const normalizedBeforeCaret = normalize(acceptedBeforeCaret);
              if (raw === null || normalizedBeforeCaret === null || raw.length > 256) return;
              const rawCaret = normalizedBeforeCaret.length;
              setExpression(raw);
              pendingCaretRef.current = rawCaret;
              setResult("");
              setError("");
              setJustEvaluated(false);
            }}
            onMouseDown={event => event.stopPropagation()}
            className={`w-full min-w-0 bg-transparent text-right font-medium tabular-nums text-[#748195] outline-none ${formatQuickExpression(expression || "0").length > 14 ? "text-[22px]" : "text-[32px] sm:text-[36px]"}`}
          />
          {error ? <p className="mt-2 max-w-full break-words text-sm font-medium leading-snug text-[#748195]">{error}</p> : <p className="mt-1 max-w-full break-all text-[48px] font-semibold leading-tight tracking-tight tabular-nums sm:text-[52px] text-[#26364A] dark:text-[#E6ECF3]">{result || " "}</p>}
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
