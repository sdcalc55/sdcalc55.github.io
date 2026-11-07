"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Bookmark, ChartNoAxesCombined, Copy, House, RotateCcw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { formatInput } from "@/lib/calculator";
import { scrollFocusedInputIntoView } from "@/lib/scroll-focused-input";
import { calculateMortgage, type MortgageMode } from "@/lib/mortgage";
import { getCalculationHistory, getHistoryMode, removeCalculationByParams, saveCalculation, upsertCalculationByParams, type CalculationRecord } from "@/lib/history";

const rubles = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 6 });
const scrollPageToTop = () => {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.matches("input, textarea, select")) active.blur();

  const scroll = () => {
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
    window.scrollTo({ top: 0, left: 0, behavior });
    document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior });
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  };

  // Let the mobile keyboard close before asking the page to move.
  requestAnimationFrame(() => {
    scroll();
    window.setTimeout(scroll, 180);
    window.setTimeout(scroll, 360);
  });
};
const configs: { mode: MortgageMode; title: string; description: string; labels: string[]; defaults: string[]; resultLabel: string }[] = [
  { mode: "part", title: "Рассчитать первоначальный взнос", description: "Узнайте сумму ПВ исходя из стоимости ОН и %ПВ", labels: ["Стоимость объекта, ₽", "Необходимый первоначальный взнос, %"], defaults: ["", "20,1"], resultLabel: "Сумма первоначального взноса" },
  { mode: "whole", title: "Рассчитать бюджет по ПВ", description: "Определите бюджет по первоначальному взносу", labels: ["Сумма первоначального взноса, ₽", "Необходимый первоначальный взнос, %"], defaults: ["", "20,1"], resultLabel: "Стоимость объекта недвижимости" },
  { mode: "adjustment", title: "Рассчитать стоимость при частичном ПВ", description: "Рассчитайте стоимость ОН с учетом ЧПВ клиента и необходимого %ПВ", labels: ["Стоимость объекта, ₽", "Сумма первоначального взноса, ₽", "Необходимый первоначальный взнос, %"], defaults: ["", "", "20,1"], resultLabel: "Стоимость с расчётной корректировкой" },
];

const formulas: Record<MortgageMode, string> = {
  part: "Стоимость ОН × % ПВ",
  whole: "Сумма ПВ × 100 ÷ % ПВ",
  adjustment: "Стоимость ОН × 100 ÷ (100 − недостающий % ПВ)",
};

const themes = {
  part: { background: "bg-[#FCEBEA] dark:bg-[#263442]", accent: "text-[#D68B86] dark:text-[#E69A94]", border: "border-[#F1DCD9] dark:border-[#3B5064]", link: "border-[#F1DCD9] bg-[#FFF7F6] text-[#C94B45] hover:bg-[#FCEBEA] dark:border-[#65413F] dark:bg-[#352322] dark:text-[#E69A94]" },
  whole: { background: "bg-[#FAF3E6] dark:bg-[#303238]", accent: "text-[#967A3E] dark:text-[#D6BD83]", border: "border-[#EADFC7] dark:border-[#4B4E55]", link: "border-[#EADFC7] bg-[#FFFBF3] text-[#967A3E] hover:bg-[#FAF3E6] dark:border-[#62543A] dark:bg-[#332D20] dark:text-[#D6BD83]" },
  adjustment: { background: "bg-[#EAF2FB] dark:bg-[#20363A]", accent: "text-[#52769D] dark:text-[#91C7C5]", border: "border-[#D6E2F0] dark:border-[#36575B]", link: "border-[#D6E2F0] bg-[#F5F9FE] text-[#52769D] hover:bg-[#EAF2FB] dark:border-[#405A75] dark:bg-[#202F40] dark:text-[#91B5DD]" },
};

function MortgageInput({ id, label, value, money, suffix, placeholder, onChange }: { id: string; label: string; value: string; money: boolean; suffix?: string; placeholder: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);
  const [, render] = useState(0);
  useLayoutEffect(() => {
    if (cursor.current !== null) { ref.current?.setSelectionRange(cursor.current, cursor.current); cursor.current = null; }
  });
  return <div><label htmlFor={id} className="mb-3 block text-sm font-semibold">{label}</label><div className="relative"><input id={id} ref={ref} value={value} inputMode="decimal" enterKeyHint="done" autoComplete="off" placeholder={placeholder} onFocus={event => { if (money && value === "0") event.currentTarget.select(); scrollFocusedInputIntoView(event.currentTarget, id === "mortgage-adjustment-1" ? document.getElementById("mortgage-adjustment-2") : null); }} onClick={event => { if (money && value === "0") event.currentTarget.select(); scrollFocusedInputIntoView(event.currentTarget, id === "mortgage-adjustment-1" ? document.getElementById("mortgage-adjustment-2") : null); }} onKeyDown={event => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.blur(); }
  }} onChange={event => {
    const raw = event.target.value;
    const digitsBeforeDecimal = raw.replace(/\s/g, "").split(/[.,]/)[0].replace(/^0+/, "");
    if (money && digitsBeforeDecimal.length > 10) return;
    const position = event.target.selectionStart ?? raw.length;
    const significant = raw.slice(0, position).replace(/\s/g, "").length;
    const next = money
       ? formatInput(raw)
       : (() => {
           const normalized = raw.replace(",", ".").replace(/[^\d.]/g, "");
           const parts = normalized.split(".");
           const candidate = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : normalized;
           const numericValue = Number(candidate);
           if (candidate !== "" && Number.isFinite(numericValue) && numericValue > 100) return value;
           return candidate;
         })();
    let index = 0, count = 0;
    while (index < next.length && count < significant) { if (!/\s/.test(next[index])) count++; index++; }
    cursor.current = index; onChange(next); render(n => n + 1);
  }} aria-invalid={money && value !== "" && Number(value.replace(/[\s\u00a0\u202f]/g, "")) > 999999999} className={`h-[54px] w-full rounded-xl border border-[#E4E8ED] bg-[#F7F8FA] px-4 ${suffix ? "pr-11" : ""} text-lg font-medium tabular-nums outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[#8993A2] focus:border-[#E83C35] focus:ring-4 focus:ring-[#E83C35]/10`} />{suffix && <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-base text-[#7B8797]">{suffix}</span>}</div>{money && value !== "" && Number(value.replace(/[\s\u00a0\u202f]/g, "")) > 999999999 && <p role="alert" className="mt-2 text-sm text-[#BD302A]">{label.toLowerCase().includes("первоначального взноса") ? "Первоначальный взнос больше миллиарда? Кажется, ипотека вам уже не нужна! 😄" : "Объект дороже 999 999 999 рублей? Кажется, мы нашли элитную недвижимость! 😄"}</p>}</div>;
}

function MortgageCard({ config }: { config: typeof configs[number] }) {
  const [values, setValues] = useState(config.defaults);
  const [valuesRestored, setValuesRestored] = useState(false);
  const storageKey = `sd-mortgage-${config.mode}`;
  useEffect(() => {
    try {
      const isRefresh = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type === "reload";
      const activeCalculator = window.sessionStorage.getItem("sd-current-screen") === "mortgage" && window.sessionStorage.getItem("sd-mortgage-tab") === "downpayment";
      if (isRefresh && activeCalculator) window.sessionStorage.removeItem(storageKey);
      const saved = isRefresh && activeCalculator ? null : window.sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === config.defaults.length && parsed.every(value => typeof value === "string")) setValues(parsed);
      }
    } catch {}
    setValuesRestored(true);
  }, [storageKey, config.defaults]);
  useEffect(() => {
    if (!valuesRestored) return;
    try { window.sessionStorage.setItem(storageKey, JSON.stringify(values)); } catch {}
  }, [values, valuesRestored, storageKey]);
  const [savedKey, setSavedKey] = useState("");
  const [dismissedKey, setDismissedKey] = useState("");
  const [historyModeVersion, setHistoryModeVersion] = useState(0);
  useEffect(() => { const update = () => setHistoryModeVersion(v => v + 1); window.addEventListener("sd-history-settings-updated", update); return () => window.removeEventListener("sd-history-settings-updated", update); }, []);
  const result = calculateMortgage(config.mode, values);
  const Icon = config.mode === "part" ? Wallet : config.mode === "adjustment" ? ChartNoAxesCombined : House;
  const adjustment = config.mode === "adjustment";
  const downPayment = adjustment && result.status === "ok" ? calculateMortgage("part", [String(result.total), values[2]], true) : null;
  const theme = themes[config.mode];
  const historyKind = config.mode === "part" ? "mortgage-part" : config.mode === "whole" ? "mortgage-whole" : "mortgage-adjustment";
  const snapshotKey = JSON.stringify(values);
  const snapshotParams = Object.fromEntries(config.labels.map((label, index) => [label, values[index]]));
  useEffect(() => {
    const syncSavedState = () => {
      const exists = getCalculationHistory().some(item => item.kind === historyKind && JSON.stringify(item.params) === JSON.stringify(snapshotParams));
      setSavedKey(exists ? snapshotKey : "");
    };
    syncSavedState();
    window.addEventListener("sd-history-updated", syncSavedState);
    return () => window.removeEventListener("sd-history-updated", syncSavedState);
  }, [snapshotKey, historyKind, JSON.stringify(snapshotParams)]);
  useEffect(() => {
    const restore = (event: Event) => {
      const record = (event as CustomEvent<CalculationRecord>).detail;
      const expected = config.mode === "part" ? "mortgage-part" : config.mode === "whole" ? "mortgage-whole" : "mortgage-adjustment";
      if (record?.kind !== expected) return;
      setValues(config.labels.map(label => record.params[label] ?? ""));
      setSavedKey("");
    };
    window.addEventListener("sd-history-restore", restore);
    return () => window.removeEventListener("sd-history-restore", restore);
  }, [config]);
  useEffect(() => {
    if (getHistoryMode() !== "auto" || result.status !== "ok" || savedKey === snapshotKey || dismissedKey === snapshotKey) return;
    const timer = window.setTimeout(() => {
      const kind = config.mode === "part" ? "mortgage-part" : config.mode === "whole" ? "mortgage-whole" : "mortgage-adjustment";
      upsertCalculationByParams({ kind, title: config.title, summary: `${rubles.format(result.total)} ₽`, params: snapshotParams, results: { [config.resultLabel]: `${rubles.format(result.total)} ₽`, formula: result.formula, ...(downPayment?.status === "ok" ? { downPayment: `${rubles.format(downPayment.total)} ₽` } : {}) } });
      setSavedKey(snapshotKey);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [snapshotKey, result.status, result.status === "ok" ? result.total : 0, savedKey, dismissedKey, config, values, downPayment?.status, downPayment?.status === "ok" ? downPayment.total : 0, historyModeVersion]);

  const isSaved = savedKey === snapshotKey;
  const save = () => {
    if (result.status !== "ok") return;
    if (isSaved) {
      removeCalculationByParams(historyKind, snapshotParams);
      setSavedKey("");
      setDismissedKey(snapshotKey);
      return;
    }
    saveCalculation({ kind: historyKind, title: config.title, summary: `${rubles.format(result.total)} ₽`, params: Object.fromEntries(config.labels.map((label, index) => [label, values[index]])), results: { [config.resultLabel]: `${rubles.format(result.total)} ₽`, formula: result.formula, ...(downPayment?.status === "ok" ? { downPayment: `${rubles.format(downPayment.total)} ₽` } : {}) } });
    setSavedKey(snapshotKey);
    setDismissedKey("");
  };
  const copy = async () => {
    if (result.status !== "ok") return;
    try { const lines = [`${config.resultLabel}: ${rubles.format(result.total)} ₽`, ...(downPayment?.status === "ok" ? [`Первоначальный взнос: ${rubles.format(downPayment.total)} ₽`] : [])]; await navigator.clipboard.writeText(lines.join("\n")); toast.success("Скопировано в буфер обмена"); }
    catch { toast.error("Не удалось скопировать сумму. Выделите и скопируйте её вручную."); }
  };
  return <section id={`mortgage-${config.mode}`} tabIndex={-1} aria-labelledby={`mortgage-${config.mode}-title`} className={`min-w-0 scroll-mt-6 rounded-3xl border border-[#EBEEF2] bg-white p-6 outline-offset-4 focus-visible:outline-2 focus-visible:outline-[#26364A] sm:p-8 ${adjustment ? "lg:col-span-2" : ""}`}>
    <div className="mb-4 flex items-center gap-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${theme.background} ${theme.accent}`}><Icon className="size-5" /></span><h2 id={`mortgage-${config.mode}-title`} className="text-xl font-semibold leading-snug tracking-tight">{config.title}</h2></div>
    <p className="mb-6 text-sm leading-relaxed text-[#748195]">{config.description}</p>
    <div className={adjustment ? "grid min-w-0 gap-6 lg:grid-cols-2" : ""}>
      <div className="space-y-4">{config.labels.map((label, index) => <MortgageInput key={label} id={`mortgage-${config.mode}-${index}`} label={label} value={values[index]} money={index === 0 || (adjustment && index === 1)} suffix={index === config.labels.length - 1 ? "%" : "₽"} placeholder={index === config.labels.length - 1 ? "Введите число" : index === 0 && config.mode !== "whole" ? "Введите стоимость" : "Введите сумму"} onChange={value => setValues(previous => previous.map((old, i) => i === index ? value : old))} />)}</div>
      <div aria-live="polite" aria-atomic="true" className={`min-w-0 rounded-2xl border p-5 ${theme.background} ${theme.border} ${adjustment ? "" : "mt-5"}`}>
        <div className="flex items-start justify-between gap-3"><p className="text-xs font-medium leading-relaxed text-[#6E7886]">{result.status === "sufficient" ? "Первоначальный взнос" : config.resultLabel}</p><button type="button" disabled={result.status !== "ok"} onClick={copy} aria-label={`Скопировать: ${config.title}`} className="shrink-0 rounded-lg p-1 text-[#647184] outline-offset-2 hover:bg-white/60 focus-visible:outline-2 disabled:opacity-30 dark:text-[#AAB6C5]"><Copy className="size-4" /></button></div>
        <output data-testid={`mortgage-result-${config.mode}`} className={`mt-3 block break-words ${result.status === "sufficient" ? "text-base sm:text-lg" : "text-[32px]"} font-semibold leading-tight tracking-tight tabular-nums ${theme.accent}`}>{result.status === "ok" ? <span className="whitespace-nowrap">{rubles.format(result.total)} ₽</span> : result.status === "sufficient" ? <><span data-testid="mortgage-sufficient-percent" className="block whitespace-nowrap text-base font-bold sm:text-lg">У клиента {percent.format(result.clientPercent)}% ПВ</span></> : "-"}</output>
        {result.status === "ok" && adjustment && <dl className={`mt-5 space-y-3 border-t pt-4 text-xs ${theme.border}`}><div className="flex flex-wrap justify-between gap-2"><dt className="text-[#6E7886]">Первоначальный взнос у клиента</dt><dd data-testid="mortgage-client-percent" className="font-medium">{percent.format(result.clientPercent!)} %</dd></div><div className="flex flex-wrap justify-between gap-2"><dt className="text-[#6E7886]">Сколько % ПВ не хватает для ипотеки</dt><dd data-testid="mortgage-missing-percent" className="font-medium">{percent.format(result.missingPercent!)} %</dd></div></dl>}
        <p role={result.status === "error" ? "alert" : undefined} className={`mt-3 break-words text-xs leading-relaxed ${result.status === "error" ? "text-[#A94442]" : "text-[#6E7886]"}`}>{result.status === "error" ? result.message : result.status === "empty" ? "Заполните поля" : result.status === "sufficient" ? "Корректировка стоимости не требуется." : null}</p>
        {result.status === "ok" && <details className="mt-3 border-t pt-3 text-xs leading-relaxed text-[#6E7886]"><summary className="cursor-pointer font-semibold">Подробности расчёта</summary><p data-testid={`mortgage-formula-explanation-${config.mode}`} className="mt-2 break-words">{formulas[config.mode]}</p><p className="mt-2 break-words">{config.mode === "part" ? result.formula.replace(/ ÷ 100$/, "%") : result.formula} = <span className="whitespace-nowrap">{rubles.format(result.total)} ₽</span></p></details>}
        {downPayment && <div className={`mt-4 border-t pt-4 ${theme.border}`}>
          <p className="text-xs font-medium text-[#6E7886]">Сумма первоначального взноса</p>
          <output data-testid="mortgage-adjustment-down-payment" className={`mt-2 block text-xl font-semibold tabular-nums ${theme.accent}`}>
            {downPayment.status === "ok" ? <span className="whitespace-nowrap">{rubles.format(downPayment.total)} ₽</span> : "-"}
          </output>
          {downPayment.status === "error" && <p role="alert" className="mt-2 text-xs text-[#A94442]">{downPayment.message}</p>}
        </div>}
      </div>
    </div>
    <div className={`mt-5 grid items-center border-t border-[#EBEEF2] pt-3 ${adjustment ? "grid-cols-3" : "grid-cols-3 lg:grid-cols-2"}`}><button type="button" aria-label="Наверх" title="Наверх" onClick={scrollPageToTop} className={`flex h-12 items-center justify-center border-r ${theme.border} text-[#26364A] hover:text-[#E83C35] ${adjustment ? "" : "lg:hidden"}`}><ArrowUp className="size-5" /></button><button type="button" aria-label={isSaved ? `Убрать из истории: ${config.title}` : `Сохранить: ${config.title}`} title={isSaved ? "Убрать из истории" : "Сохранить в историю"} disabled={result.status !== "ok"} onClick={save} className={`flex h-12 min-w-12 items-center justify-center border-r ${theme.border} disabled:opacity-30 ${isSaved ? "text-[#E83C35]" : "text-[#26364A] hover:text-[#E83C35]"}`}><Bookmark className="size-5" fill={isSaved ? "currentColor" : "none"} /></button><button type="button" aria-label={`Сбросить: ${config.title}`} title="Сбросить" onClick={() => { setValues(previous => previous.map((value, i) => i === previous.length - 1 ? value : "")); setSavedKey(""); }} className="flex h-12 items-center justify-center text-[#26364A] hover:text-[#E83C35]"><RotateCcw className="size-5" /></button></div>
  </section>;
}

export function MortgageCalculators() {
  const [activeMode, setActiveMode] = useState<MortgageMode | null>("part");
  const navigationRef = useRef<HTMLElement>(null);
  useEffect(() => {
    let previousY = window.scrollY;
    const resetOnReturn = () => {
      const currentY = window.scrollY;
      const navigation = navigationRef.current;
      if (currentY <= previousY && navigation && navigation.getClientRects().length > 0 && navigation.getBoundingClientRect().top >= 0) {
        setActiveMode(null);
      }
      previousY = currentY;
    };
    window.addEventListener("scroll", resetOnReturn, { passive: true });
    return () => window.removeEventListener("scroll", resetOnReturn);
  }, []);
  return <div><div className="mb-5 lg:hidden"><nav ref={navigationRef} aria-label="Выберите нужный расчёт" className="grid grid-cols-3 border-b border-[#E4E8ED]">{configs.map(config => <a key={config.mode} href={`#mortgage-${config.mode}`} aria-label={config.title} aria-current={activeMode === config.mode ? "location" : undefined} onClick={event => {
    event.preventDefault();
    setActiveMode(config.mode);
    const target = document.getElementById(`mortgage-${config.mode}`);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }} className={`inline-flex min-h-11 min-w-0 items-center justify-center whitespace-nowrap border-b-2 px-[3px] py-2 text-sm leading-5 font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26364A] ${activeMode === config.mode ? "border-[#E83C35] text-[#26364A]" : "border-transparent text-[#647184] hover:border-[#C5CDD8] hover:text-[#26364A]"}`}>{config.mode === "part" ? "Взнос" : config.mode === "whole" ? "Бюджет" : "Частичный ПВ"}</a>)}</nav></div><div className="grid items-start gap-6 lg:grid-cols-2">{configs.map(config => <MortgageCard key={config.mode} config={config} />)}</div>
    <section aria-label="Округление расчётов" className="mt-8 rounded-3xl border border-[#EBEEF2] bg-white p-6 sm:p-8">
      <p className="-mx-3 text-center text-[11px] leading-loose text-[#7B8797] min-[375px]:text-xs sm:mx-0 sm:text-sm"><span className="block whitespace-nowrap">Расчёт без промежуточного округления</span><span className="block whitespace-nowrap">Итог округляется вверх до целого рубля</span></p>
    </section>
  </div>;
}
