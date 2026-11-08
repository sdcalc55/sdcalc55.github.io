"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Calculator, RotateCcw, X } from "lucide-react";
import { focusNextCalculatorInput } from "@/lib/calculator-input";
import { toast } from "sonner";
import { CalculatorResultActions } from "@/components/calculator-result-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatInput } from "@/lib/calculator";
import { scrollFocusedInputIntoView } from "@/lib/scroll-focused-input";
import { calculateLoan, calculateLoanFromPayment, type LoanResult } from "@/lib/loan";
import { getCalculationHistory, getHistoryMode, removeCalculationByParams, saveCalculation, upsertCalculationByParams, type CalculationRecord } from "@/lib/history";

const currency = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amount = (value: number) => `${currency.format(value)}\u00a0₽`;
const parse = (value: string) => {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  return /^\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
};
const exceedsAmountLimit = (value: string) => Number(value.replace(/\D/g, "")) > 999999999;

const dismissKeyboard = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === "-" || event.key === "−" || event.key === "Subtract") event.preventDefault();
  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
    event.preventDefault();
    focusNextCalculatorInput(event.currentTarget);
  }
};

type LoanMode = "principal" | "payment";
type LoanDraft = { value: string; term: string; unit: string; rate: string; result: LoanResult | null; error: string; changed: boolean; calculated: boolean };
const emptyDraft = (): LoanDraft => ({ value: "", term: "", unit: "years", rate: "", result: null, error: "", changed: false, calculated: false });

export function LoanCalculator() {
  const [mode, setMode] = useState<LoanMode>("principal");
  const [drafts, setDrafts] = useState<Record<LoanMode, LoanDraft>>({ principal: emptyDraft(), payment: emptyDraft() });
  const [draftsRestored, setDraftsRestored] = useState(false);
  useEffect(() => {
    try {
      const isRefresh = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type === "reload";
      const activeCalculator = window.sessionStorage.getItem("sd-current-screen") === "mortgage" && window.sessionStorage.getItem("sd-mortgage-tab") === "loan";
      if (isRefresh && activeCalculator) window.sessionStorage.removeItem("sd-loan-drafts");
      const saved = isRefresh && activeCalculator ? null : window.sessionStorage.getItem("sd-loan-drafts");
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Record<LoanMode, LoanDraft>>;
        setDrafts(previous => ({ principal: { ...previous.principal, ...(parsed.principal ?? {}) }, payment: { ...previous.payment, ...(parsed.payment ?? {}) } }));
      }
    } catch {}
    setDraftsRestored(true);
  }, []);
  useEffect(() => {
    if (!draftsRestored) return;
    try {
      const { principal, payment } = drafts;
      const serializable = (draft: LoanDraft) => ({ ...draft, result: null, error: "", changed: true });
      window.sessionStorage.setItem("sd-loan-drafts", JSON.stringify({ principal: serializable(principal), payment: serializable(payment) }));
    } catch {}
  }, [drafts, draftsRestored]);
  const { value, term, unit, rate, result, error, changed, calculated } = drafts[mode];
  const reverse = mode === "payment";
  const update = (patch: Partial<LoanDraft>) => setDrafts(previous => ({ ...previous, [mode]: { ...previous[mode], ...patch } }));
  const edit = (patch: Partial<LoanDraft>) => update({ ...patch, changed: true, error: "" });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!term.trim() && value.trim() && rate.trim()) { update({ error: "Введите срок кредита", result: null }); document.getElementById("loan-term")?.focus(); return; }
    if (!value.trim() || !term.trim()) { update({ error: "Заполните поля", result: null }); document.getElementById(!value.trim() ? (reverse ? "loan-payment" : "loan-principal") : "loan-term")?.focus(); return; }
    if (!rate.trim()) { update({ error: "Введите ставку", result: null }); document.getElementById("loan-rate")?.focus(); return; }
    if (exceedsAmountLimit(value)) { update({ error: "", result: null, changed: true }); return; }
    if (Number(term) > (unit === "years" ? 30 : 360) || parse(rate) > 30) { update({ error: "", result: null, changed: true }); return; }
    try {
      const months = unit === "years" ? Math.round(parse(term) * 12) : parse(term);
      const calculation = reverse ? calculateLoanFromPayment(parse(value), months, parse(rate)) : calculateLoan(parse(value), months, parse(rate));
      update({ result: calculation, error: "", changed: false, calculated: true });
    } catch (error) { update({ error: error instanceof Error ? error.message : "Проверьте параметры кредита.", result: null }); }
  };
  const reset = () => setDrafts(previous => ({ ...previous, [mode]: emptyDraft() }));
  useEffect(() => {
    if (!drafts[mode].calculated) return;
    const current = drafts[mode];
    if (!current.value.trim() || !current.term.trim() || !current.rate.trim()) {
      setDrafts(previous => ({ ...previous, [mode]: { ...previous[mode], result: null, error: "", changed: true } }));
      return;
    }
    if (exceedsAmountLimit(current.value)) {
      setDrafts(previous => ({ ...previous, [mode]: { ...previous[mode], result: null, error: "", changed: false } }));
      return;
    }
    if (parse(current.rate) > 30) {
      setDrafts(previous => ({ ...previous, [mode]: { ...previous[mode], result: null, error: "Кажется, с процентами немного перебор.\nС такой ставкой кредит лучше не брать 🙂", changed: false } }));
      return;
    }
    const termLimit = current.unit === "years" ? 30 : 360;
    if (parse(current.term) > termLimit) {
      setDrafts(previous => ({ ...previous, [mode]: { ...previous[mode], result: null, error: current.unit === "years" ? "30 лет - наш предел. На более долгий срок кредит пока не выдают 😄" : "360 месяцев - наш предел. Укажите меньший срок кредита.", changed: false } }));
      return;
    }
    try {
      const months = current.unit === "years" ? Math.round(parse(current.term) * 12) : parse(current.term);
      const calculation = mode === "payment"
        ? calculateLoanFromPayment(parse(current.value), months, parse(current.rate))
        : calculateLoan(parse(current.value), months, parse(current.rate));
      setDrafts(previous => ({ ...previous, [mode]: { ...previous[mode], result: calculation, error: "", changed: false } }));
    } catch (calculationError) {
      setDrafts(previous => ({ ...previous, [mode]: { ...previous[mode], result: null, error: calculationError instanceof Error ? calculationError.message : "Проверьте параметры кредита.", changed: false } }));
    }
  }, [mode, drafts[mode].value, drafts[mode].term, drafts[mode].unit, drafts[mode].rate, drafts[mode].calculated]);
  const [savedKey, setSavedKey] = useState("");
  const [dismissedKey, setDismissedKey] = useState("");
  const [historyModeVersion, setHistoryModeVersion] = useState(0);
  useEffect(() => { const update = () => setHistoryModeVersion(v => v + 1); window.addEventListener("sd-history-settings-updated", update); return () => window.removeEventListener("sd-history-settings-updated", update); }, []);
  const snapshotParams = { mode, value, term, unit, rate };
  const snapshotKey = JSON.stringify(snapshotParams);
  useEffect(() => {
    const syncSavedState = () => {
      const exists = getCalculationHistory().some(item => item.kind === "loan" && JSON.stringify(item.params) === JSON.stringify(snapshotParams));
      setSavedKey(exists ? snapshotKey : "");
    };
    syncSavedState();
    window.addEventListener("sd-history-updated", syncSavedState);
    return () => window.removeEventListener("sd-history-updated", syncSavedState);
  }, [snapshotKey, mode, value, term, unit, rate]);
  useEffect(() => {
    const restore = (event: Event) => {
      const record = (event as CustomEvent<CalculationRecord>).detail;
      if (record?.kind !== "loan") return;
      const target: LoanMode = record.params.mode === "payment" ? "payment" : "principal";
      setMode(target);
      setDrafts(previous => ({ ...previous, [target]: {
        ...emptyDraft(), value: record.params.value || "", term: record.params.term || "",
        unit: record.params.unit || "years", rate: record.params.rate || "", calculated: true
      }}));
    };
    window.addEventListener("sd-history-restore", restore);
    return () => window.removeEventListener("sd-history-restore", restore);
  }, []);
  useEffect(() => {
    if (getHistoryMode() !== "auto" || !result || changed || error || savedKey === snapshotKey || dismissedKey === snapshotKey) return;
    const timer = window.setTimeout(() => {
      upsertCalculationByParams({ kind: "loan", title: "Кредитный калькулятор", summary: amount(result.monthlyPayment), params: snapshotParams, results: { monthlyPayment: amount(result.monthlyPayment), principal: amount(result.principal), interest: amount(result.interest), totalPayment: amount(result.totalPayment), months: String(result.months), annualRate: `${result.annualRate}%` } });
      setSavedKey(snapshotKey);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [snapshotKey, result, changed, error, savedKey, dismissedKey, mode, value, term, unit, rate, historyModeVersion]);

  const isSaved = savedKey === snapshotKey;
  const copyResults = async () => {
    if (!result || changed || error) {
      toast.error("Сначала выполните корректный расчёт");
      return;
    }
    const lines = [
      `Ежемесячный платёж: ${amount(result.monthlyPayment)}`,
      `Сумма кредита: ${amount(result.principal)}`,
      `Переплата по процентам: ${amount(result.interest)}`,
      `Общая сумма: ${amount(result.totalPayment)}`,
      `Срок кредита: ${result.months} мес.`,
      `Годовая ставка: ${result.annualRate}%`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Скопировано в буфер обмена");
    } catch {
      toast.error("Не удалось скопировать результаты");
    }
  };
  const save = () => {
    if (!result || changed || error) return;
    if (isSaved) {
      removeCalculationByParams("loan", snapshotParams);
      setSavedKey("");
      setDismissedKey(snapshotKey);
      toast.success("Расчёт удалён из истории");
      return;
    }
    saveCalculation({ kind: "loan", title: "Кредитный калькулятор", summary: amount(result.monthlyPayment), params: { mode, value, term, unit, rate }, results: { monthlyPayment: amount(result.monthlyPayment), principal: amount(result.principal), interest: amount(result.interest), totalPayment: amount(result.totalPayment), months: String(result.months), annualRate: `${result.annualRate}%` } });
    setSavedKey(snapshotKey);
    setDismissedKey("");
    toast.success("Расчёт сохранён в истории");
  };
  const inputStyle = "h-14 w-full min-w-0 rounded-xl border border-[#E4E8ED] bg-[#F7F8FA] px-4 text-lg font-medium tabular-nums outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[#8993A2] focus:border-[#E83C35] focus:ring-4 focus:ring-[#E83C35]/10";
  return <div>
    <div role="group" aria-label="Режим кредитного расчёта" className="mb-5 grid grid-cols-2 border-b border-[#E4E8ED] sm:flex sm:overflow-x-auto">
      {(["principal", "payment"] as const).map(item => <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)} className={`min-h-14 min-w-0 text-balance border-b-2 px-2 py-3 text-sm leading-5 font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26364A] sm:min-h-12 sm:min-w-max sm:flex-1 sm:whitespace-nowrap sm:px-3 ${mode === item ? "border-[#E83C35] text-[#26364A]" : "border-transparent text-[#647184] hover:border-[#C5CDD8] hover:text-[#26364A]"}`} aria-label={item === "principal" ? "По сумме кредита" : "По ежемесячному платежу"}>{item === "principal" ? "По сумме кредита" : "По ежемесячному платежу"}</button>)}
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.1fr]">
    <form onSubmit={submit} autoComplete="off" className="min-w-0 rounded-3xl border border-[#EBEEF2] bg-white p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3"><span className="relative left-3 flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#FCEBEA] text-[#E83C35]"><Calculator className="size-6" /></span><h3 className="text-xl font-semibold">Параметры кредита</h3></div>
      <div className="space-y-5">
        <div><label htmlFor={reverse ? "loan-payment" : "loan-principal"} className="mb-3 block text-sm font-semibold">{reverse ? "Комфортный платёж в месяц" : "Сумма кредита"}</label><div className="relative"><input name={reverse ? "sd-calc-loan-payment" : "sd-calc-loan-principal"} id={reverse ? "loan-payment" : "loan-principal"} onFocus={event => scrollFocusedInputIntoView(event.currentTarget)} onClick={event => scrollFocusedInputIntoView(event.currentTarget)} inputMode="decimal" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="next" onKeyDown={dismissKeyboard} autoComplete="off" value={value} onChange={event => {
          const raw = event.target.value.replace(/[^\d.,]/g, "").replace(/([.,].*)[.,]/g, "$1");
          const digitsBeforeDecimal = raw.replace(/\s/g, "").split(/[.,]/)[0].replace(/^0+/, "");
          if (digitsBeforeDecimal.length > 10) return;
          edit({ value: formatInput(raw) });
        }} placeholder={reverse ? "Введите платёж" : "Введите сумму"} aria-invalid={value !== "" && parse(value) > 999999999} className={`${inputStyle} pr-[4.5rem]`} />{value !== "" && <button type="button" aria-label="Очистить поле" title="Очистить" onMouseDown={event => event.preventDefault()} onClick={() => { edit({ value: "" }); document.getElementById(reverse ? "loan-payment" : "loan-principal")?.focus(); }} className="absolute right-10 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[#8993A2] hover:bg-black/5 hover:text-[#26364A] dark:hover:bg-white/10 dark:hover:text-white"><X className="size-4" /></button>}<span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7B8797]">₽</span></div>{value !== "" && parse(value) > 999999999 && <p role="alert" className="mt-2 text-sm leading-relaxed text-[#BD302A]">{reverse ? "Платёж больше миллиарда в месяц? Кажется, такой кредит вам точно не нужен 😄" : "Банк уже знает, что вы собираетесь у него попросить? 😄"}</p>}</div>
        <div>
          <label htmlFor="loan-term" className="mb-3 block text-sm font-semibold">Срок кредита</label>
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
            <div className="relative">
              <input name="sd-calc-loan-term" id="loan-term" onFocus={event => scrollFocusedInputIntoView(event.currentTarget)} onClick={event => scrollFocusedInputIntoView(event.currentTarget)} inputMode="numeric" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="next" autoComplete="off" onKeyDown={dismissKeyboard} value={term} onChange={event => {
                const raw = event.target.value.replace(/[^\d]/g, "").slice(0, 3);
                edit({ term: raw });
              }} placeholder="Введите срок" className="h-14 w-full min-w-0 rounded-xl border border-[#E4E8ED] bg-[#F7F8FA] px-4 pr-11 text-lg font-medium tabular-nums outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[#8993A2] focus:border-[#E83C35] focus:ring-4 focus:ring-[#E83C35]/10" />
              {term !== "" && <button type="button" aria-label="Очистить поле" title="Очистить" onMouseDown={event => event.preventDefault()} onClick={() => { edit({ term: "" }); document.getElementById("loan-term")?.focus(); }} className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[#8993A2] hover:bg-black/5 hover:text-[#26364A] dark:hover:bg-white/10 dark:hover:text-white"><X className="size-4" /></button>}
            </div>
            <Select value={unit} onValueChange={nextUnit => {
              if (nextUnit === unit) return;
              const numericTerm = term.trim() ? parse(term) : NaN;
              const converted = Number.isFinite(numericTerm)
                ? nextUnit === "years" ? (numericTerm / 12).toFixed(2).replace(/\.0+$|(?<=\.[0-9])0$/, "").replace(/\.$/, "") : String(Math.round(numericTerm * 12))
                : "";
              edit({ unit: nextUnit, term: converted });
            }}>
              <SelectTrigger aria-label="Единицы срока кредита" className="h-14 min-h-14 data-[size=default]:h-14 w-28 min-w-0 self-start rounded-xl border-[#E4E8ED] bg-[#F7F8FA] px-3 text-sm shadow-none focus:ring-2 focus:ring-[#E83C35] dark:border-[#35414F] dark:bg-[#0D1219]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="end" className="min-w-28 rounded-xl border-[#E4E8ED] bg-white shadow-lg dark:border-[#405064] dark:bg-[#253241]">
                <SelectItem value="years" className="cursor-pointer rounded-lg py-3 text-sm">лет</SelectItem>
                <SelectItem value="months" className="cursor-pointer rounded-lg py-3 text-sm">месяцев</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {term !== "" && Number.isFinite(Number(term)) && Number(term) > (unit === "years" ? 30 : 360) && <p role="alert" className="mt-2 text-sm leading-relaxed text-[#BD302A]">{unit === "years" ? "30 лет - наш предел. На более долгий срок кредит пока не выдают 😄" : "360 месяцев - наш предел. Укажите меньший срок кредита."}</p>}
        </div>
        <div><label htmlFor="loan-rate" className="mb-3 block text-sm font-semibold">Процентная ставка</label><div className="relative"><input name="sd-calc-loan-rate" id="loan-rate" onFocus={event => scrollFocusedInputIntoView(event.currentTarget)} onClick={event => scrollFocusedInputIntoView(event.currentTarget)} inputMode="decimal" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="done" autoComplete="off" onKeyDown={dismissKeyboard} value={rate} onChange={event => {
          const raw = event.target.value.replace(",", ".").replace(/[^\d.]/g, "");
          const parts = raw.split(".");
          const candidate = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : raw;
          const numeric = Number(candidate);
          const integerPart = candidate.split(".")[0];
          if (integerPart.length > 3 || (candidate !== "" && Number.isFinite(numeric) && numeric > 999)) return;
          update({ rate: candidate, changed: true, error: "" });
        }} placeholder="Введите % ставки" aria-invalid={rate !== "" && Number.isFinite(parse(rate)) && parse(rate) > 30} className={`${inputStyle} pr-11`} />{rate !== "" && <button type="button" aria-label="Очистить поле" title="Очистить" onMouseDown={event => event.preventDefault()} onClick={() => { edit({ rate: "" }); document.getElementById("loan-rate")?.focus(); }} className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[#8993A2] hover:bg-black/5 hover:text-[#26364A] dark:hover:bg-white/10 dark:hover:text-white"><X className="size-4" /></button>}</div>{rate !== "" && Number.isFinite(parse(rate)) && parse(rate) > 30 && <p role="alert" className="mt-2 text-sm leading-relaxed text-[#BD302A]">Кажется, с процентами немного перебор.<br />С такой ставкой кредит лучше не брать 🙂</p>}</div>
      </div>
      {error && <p role="alert" className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[#BD302A]">{error}</p>}
      <div className="mt-7 flex flex-wrap gap-3">{!calculated && <button type="submit" className="min-h-12 flex-1 rounded-xl bg-[#E83C35] px-5 py-3 text-sm font-semibold text-white hover:bg-[#D6332D] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E83C35]">РАССЧИТАТЬ</button>}{calculated && <p className="flex flex-1 items-center text-sm font-medium text-[#647184]">Автоматический перерасчёт</p>}<button type="button" onClick={reset} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#E4E8ED] px-4 py-3 text-sm font-semibold text-[#647184] hover:bg-[#F5F7FA]"><RotateCcw className="size-4" />СБРОСИТЬ</button></div>
    </form>
    <div className="min-w-0 space-y-4" aria-live="polite">
      {result ? <>
        <section aria-label="Результаты кредита" className="min-w-0 rounded-3xl border border-[#F3DAD8] bg-[#FCEBEA] p-6 text-[#26364A] sm:p-8 dark:border-[#405064] dark:bg-[#253241] dark:text-[#F1F5F9]">
          <h3 className="text-xl font-semibold lg:flex lg:min-h-11 lg:items-center">Результаты расчёта</h3>
          {changed && <p className="mt-3 text-xs leading-relaxed text-[#A94442]">Результат обновляется автоматически после изменения параметров.</p>}
          <p className="mb-2 mt-6 text-sm text-[#596779] dark:text-[#B8C4D2]">{reverse ? "Сумма кредита" : "Ежемесячный платёж"}</p><p data-testid={reverse ? "loan-available-principal" : "loan-monthly"} className="text-[clamp(1.75rem,7vw,2.75rem)] font-bold tracking-tight text-[#D93630] tabular-nums dark:text-[#FF665F]">{amount(reverse ? result.principal : result.monthlyPayment)}</p>
          <dl className="mt-6 space-y-4 border-t border-[#26364A]/10 pt-5 text-sm dark:border-[#607084]">
            {reverse ? <ResultRow label="Ежемесячный платёж" value={amount(result.monthlyPayment)} /> : <ResultRow label="Основной долг" value={amount(result.principal)} />}
            <ResultRow label="Переплата по процентам" value={amount(result.interest)} />
            <ResultRow label="Общая сумма" value={amount(result.totalPayment)} />
            <ResultRow label="Срок кредита" value={`${result.months} мес.`} />
          </dl>
          <svg role="img" aria-label={`Основной долг ${amount(result.principal)}, проценты ${amount(result.interest)}`} viewBox="0 0 100 12" preserveAspectRatio="none" className="mt-6 h-3 w-full overflow-hidden rounded-full"><rect width="100" height="12" className="fill-[#26364A]" /><rect width={result.principal / result.totalPayment * 100} height="12" className="fill-[#E83C35]" /></svg>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#596779] dark:text-[#C2CCD8]"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#E83C35]" />Основной долг</span><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#26364A]" />Проценты</span></div>
<div className="mt-5 border-t border-[#26364A]/10 pt-4 dark:border-[#607084]"><CalculatorResultActions onCopy={copyResults} onSave={save} isSaved={isSaved} disabled={changed || !!error} /></div>          <details className="mt-6 border-t border-[#26364A]/10 pt-4 text-xs leading-relaxed text-[#596779] dark:border-[#607084] dark:text-[#C2CCD8]"><summary className="cursor-pointer font-semibold">Подробности расчёта</summary><div className="mt-3 space-y-2 text-justify">
            <p>{reverse ? result.annualRate === 0 ? "S = A × n" : "S = A × (1 − (1 + i)⁻ⁿ) / i" : result.annualRate === 0 ? "A = S / n" : "A = S × i × (1 + i)ⁿ / ((1 + i)ⁿ − 1)"}</p>
            <p>A - ежемесячный платёж; S - сумма кредита; i - годовая ставка / 12 / 100; n - срок в месяцах.</p>
            <p>Предварительный расчёт без учёта страховок и дополнительных расходов. Не является одобрением банка. {reverse ? "Сумма кредита округляется вниз до копеек, чтобы рассчитанный платёж не превышал указанный." : "Ежемесячный платёж рассчитывается без промежуточного округления."} Суммы отображаются с точностью до копеек.</p>
          </div></details>
        </section>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <section className="min-w-0 rounded-2xl border border-[#D6E2F0] bg-[#EAF2FB] p-5 dark:border-[#405064] dark:bg-[#253241] dark:text-[#E6EDF5]"><h3 className="text-sm font-medium">Переплата</h3><p data-testid="loan-interest" className="mt-3 text-xl font-semibold tabular-nums">{amount(result.interest)}</p><p className="mt-2 text-xs leading-relaxed text-[#6E7886] dark:text-[#B8C4D2]">Общая сумма процентов за весь срок кредита</p></section>
          <section className="min-w-0 rounded-2xl border border-[#D6E2F0] bg-[#EAF2FB] p-5 dark:border-[#405064] dark:bg-[#253241] dark:text-[#E6EDF5]"><h3 className="text-sm font-medium">Общая сумма</h3><p data-testid="loan-total" className="mt-3 text-xl font-semibold tabular-nums">{amount(result.totalPayment)}</p><p className="mt-2 text-xs leading-relaxed text-[#6E7886] dark:text-[#B8C4D2]">Основной долг плюс проценты</p></section>
        </div>
      </> : <section aria-label="Результаты кредита" className="select-none rounded-3xl border border-[#EBEEF2] bg-white p-8 text-center"><Calculator className="mx-auto mb-4 size-10 text-[#D68B86]" /><h3 className="text-lg font-semibold">Здесь появятся результаты кредита</h3><p className="mt-3 text-sm leading-relaxed text-[#748195]">{reverse ? "Укажите комфортный ежемесячный платёж, срок и годовую ставку, затем нажмите «Рассчитать»" : "Укажите сумму, срок и годовую ставку, затем нажмите «Рассчитать»"}</p></section>}
    </div>
  </div></div>;
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-wrap justify-between gap-2"><dt className="text-[#596779] dark:text-[#B8C4D2]">{label}</dt><dd className="font-semibold tabular-nums text-[#26364A] dark:text-[#F1F5F9]">{value}</dd></div>;
}
