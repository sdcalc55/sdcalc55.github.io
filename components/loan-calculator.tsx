"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Bookmark, Calculator, RotateCcw } from "lucide-react";
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

const dismissKeyboard = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
    event.preventDefault();
    event.currentTarget.blur();
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
    if (!term.trim() && value.trim() && rate.trim()) { update({ error: "Введите срок кредита", result: null }); return; }
    if (!value.trim() || !term.trim()) { update({ error: "Заполните поля", result: null }); return; }
    if (!rate.trim()) { update({ error: "Введите ставку", result: null }); return; }
    if (parse(rate) > 30) { update({ error: "Кажется, с процентами немного перебор. С такой ставкой кредит лучше не брать 🙂", result: null }); return; }
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
    if (parse(current.rate) > 30) {
      setDrafts(previous => ({ ...previous, [mode]: { ...previous[mode], result: null, error: "Кажется, с процентами немного перебор. С такой ставкой кредит лучше не брать 🙂", changed: false } }));
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
  const save = () => {
    if (!result || changed || error) return;
    if (isSaved) {
      removeCalculationByParams("loan", snapshotParams);
      setSavedKey("");
      setDismissedKey(snapshotKey);
      return;
    }
    saveCalculation({ kind: "loan", title: "Кредитный калькулятор", summary: amount(result.monthlyPayment), params: { mode, value, term, unit, rate }, results: { monthlyPayment: amount(result.monthlyPayment), principal: amount(result.principal), interest: amount(result.interest), totalPayment: amount(result.totalPayment), months: String(result.months), annualRate: `${result.annualRate}%` } });
    setSavedKey(snapshotKey);
    setDismissedKey("");
  };
  const inputStyle = "h-14 w-full min-w-0 rounded-xl border border-[#E4E8ED] bg-[#F7F8FA] px-4 text-lg font-medium tabular-nums outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[#8993A2] focus:border-[#E83C35] focus:ring-4 focus:ring-[#E83C35]/10";
  return <div>
    <div role="group" aria-label="Режим кредитного расчёта" className="mb-5 grid grid-cols-2 border-b border-[#E4E8ED] sm:flex sm:overflow-x-auto">
      {(["principal", "payment"] as const).map(item => <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)} className={`min-h-14 min-w-0 text-balance border-b-2 px-2 py-3 text-sm leading-5 font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26364A] sm:min-h-12 sm:min-w-max sm:flex-1 sm:whitespace-nowrap sm:px-3 ${mode === item ? "border-[#E83C35] text-[#26364A]" : "border-transparent text-[#647184] hover:border-[#C5CDD8] hover:text-[#26364A]"}`} aria-label={item === "principal" ? "По сумме кредита" : "По ежемесячному платежу"}>{item === "principal" ? "По сумме кредита" : "По ежемесячному платежу"}</button>)}
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.1fr]">
    <form onSubmit={submit} autoComplete="off" className="min-w-0 rounded-3xl border border-[#EBEEF2] bg-white p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-[#FCEBEA] text-[#E83C35]"><Calculator className="size-6" /></span><h3 className="text-xl font-semibold">Параметры кредита</h3></div>
      <div className="space-y-5">
        <div><label htmlFor={reverse ? "loan-payment" : "loan-principal"} className="mb-3 block text-sm font-semibold">{reverse ? "Комфортный платёж в месяц" : "Сумма кредита"}</label><div className="relative"><input id={reverse ? "loan-payment" : "loan-principal"} onFocus={event => scrollFocusedInputIntoView(event.currentTarget)} onClick={event => scrollFocusedInputIntoView(event.currentTarget)} inputMode="decimal" enterKeyHint="done" onKeyDown={dismissKeyboard} autoComplete="off" value={value} onChange={event => {
          const raw = event.target.value;
          const digitsBeforeDecimal = raw.replace(/\s/g, "").split(/[.,]/)[0].replace(/^0+/, "");
          if (digitsBeforeDecimal.length > 9) return;
          edit({ value: formatInput(raw) });
        }} placeholder={reverse ? "Введите платёж" : "Введите сумму"} className={`${inputStyle} pr-12`} /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7B8797]">₽</span></div></div>
        <div><label htmlFor="loan-term" className="mb-3 block text-sm font-semibold">Срок кредита</label><div className="flex gap-2"><input id="loan-term" onFocus={event => scrollFocusedInputIntoView(event.currentTarget)} onClick={event => scrollFocusedInputIntoView(event.currentTarget)} inputMode="decimal" enterKeyHint="done" autoComplete="off" onKeyDown={dismissKeyboard} value={term} onChange={event => {
          const normalized = event.target.value.replace(",", ".");
          const raw = unit === "years"
            ? normalized.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1").replace(/^(\d{0,2})(?:\.(\d{0,2})?)?.*$/, (_, whole, fraction) => whole + (fraction !== undefined ? "." + fraction : ""))
            : normalized.replace(/[^\d]/g, "").slice(0, 3);
          const limit = unit === "years" ? 30 : 360;
          if (raw !== "" && Number(raw) > limit) {
            if (unit === "years") update({ error: "30 лет - наш предел. На более долгий срок кредит пока не выдают 😄" });
            return;
          }
          edit({ term: raw });
        }} placeholder="Введите срок" className={inputStyle} /><select aria-label="Единицы срока кредита" value={unit} onChange={event => {
          const nextUnit = event.target.value;
          if (nextUnit === unit) return;
          const numericTerm = term.trim() ? parse(term) : NaN;
          const converted = Number.isFinite(numericTerm)
            ? nextUnit === "years" ? (numericTerm / 12).toFixed(2).replace(/\.0+$|(?<=\.[0-9])0$/, "").replace(/\.$/, "") : String(Math.round(numericTerm * 12))
            : "";
          edit({ unit: nextUnit, term: converted });
        }} className="h-14 shrink-0 rounded-xl border border-[#E4E8ED] bg-[#F7F8FA] px-3 text-sm outline-none focus:ring-2 focus:ring-[#E83C35]"><option value="years">лет</option><option value="months">месяцев</option></select></div></div>
        <div><label htmlFor="loan-rate" className="mb-3 block text-sm font-semibold">Процентная ставка</label><div className="relative"><input id="loan-rate" onFocus={event => scrollFocusedInputIntoView(event.currentTarget)} onClick={event => scrollFocusedInputIntoView(event.currentTarget)} inputMode="decimal" enterKeyHint="done" autoComplete="off" onKeyDown={dismissKeyboard} value={rate} onChange={event => {
          const raw = event.target.value.replace(",", ".").replace(/[^\d.]/g, "");
          const parts = raw.split(".");
          const candidate = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : raw;
          const numeric = Number(candidate);
          const integerPart = candidate.split(".")[0];
          if (integerPart.length > 2 || (candidate !== "" && Number.isFinite(numeric) && numeric > 99)) return;
          update({ rate: candidate, changed: true, error: candidate !== "" && Number.isFinite(numeric) && numeric > 30 ? "Кажется, с процентами немного перебор. С такой ставкой кредит лучше не брать 🙂" : "" });
        }} placeholder="Введите % ставки" className={inputStyle} /></div></div>
      </div>
      {error && <p role="alert" className="mt-4 text-sm leading-relaxed text-[#BD302A]">{error}</p>}
      <div className="mt-7 flex flex-wrap gap-3">{!calculated && <button type="submit" className="min-h-12 flex-1 rounded-xl bg-[#E83C35] px-5 py-3 text-sm font-semibold text-white hover:bg-[#D6332D] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E83C35]">РАССЧИТАТЬ</button>}{calculated && <p className="flex flex-1 items-center text-sm font-medium text-[#647184]">Автоматический перерасчёт</p>}<button type="button" onClick={reset} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#E4E8ED] px-4 py-3 text-sm font-semibold text-[#647184] hover:bg-[#F5F7FA]"><RotateCcw className="size-4" />СБРОСИТЬ</button></div>
    </form>
    <div className="min-w-0 space-y-4" aria-live="polite">
      {result ? <>
        <section aria-label="Результаты кредита" className="min-w-0 rounded-3xl border border-[#F3DAD8] bg-[#FCEBEA] p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3"><h3 className="text-xl font-semibold lg:flex lg:min-h-11 lg:items-center">Результаты расчёта</h3><button type="button" aria-label={isSaved ? "Отменить сохранение" : "Сохранить в историю"} title={isSaved ? "Отменить сохранение" : "Сохранить в историю"} disabled={changed || !!error} onClick={save} className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full border transition-all duration-200 hover:scale-105 disabled:opacity-30 ${isSaved ? "border-[#E83C35]/20 bg-[#E83C35] text-white shadow-sm shadow-[#E83C35]/20" : "border-[#F0C9C6] bg-white/80 text-[#E83C35] hover:bg-[#FCEBEA]"}`}><Bookmark className="size-5" strokeWidth={2.2} fill={isSaved ? "currentColor" : "none"} /></button></div>
          {changed && <p className="mt-3 text-xs leading-relaxed text-[#A94442]">Результат обновляется автоматически после изменения параметров.</p>}
          <p className="mb-2 mt-6 text-sm text-[#6E7886]">{reverse ? "Сумма кредита" : "Ежемесячный платёж"}</p><p data-testid={reverse ? "loan-available-principal" : "loan-monthly"} className="text-[clamp(1.5rem,6vw,2.5rem)] font-semibold tracking-tight text-[#E83C35] tabular-nums">{amount(reverse ? result.principal : result.monthlyPayment)}</p>
          <dl className="mt-6 space-y-4 border-t border-[#26364A]/10 pt-5 text-sm">
            {reverse ? <ResultRow label="Ежемесячный платёж" value={amount(result.monthlyPayment)} /> : <ResultRow label="Основной долг" value={amount(result.principal)} />}
            <ResultRow label="Переплата по процентам" value={amount(result.interest)} />
            <ResultRow label="Общая сумма" value={amount(result.totalPayment)} />
            <ResultRow label="Срок кредита" value={`${result.months} мес.`} />
          </dl>
          <svg role="img" aria-label={`Основной долг ${amount(result.principal)}, проценты ${amount(result.interest)}`} viewBox="0 0 100 12" preserveAspectRatio="none" className="mt-6 h-3 w-full overflow-hidden rounded-full"><rect width="100" height="12" className="fill-[#26364A]" /><rect width={result.principal / result.totalPayment * 100} height="12" className="fill-[#E83C35]" /></svg>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#647184]"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#E83C35]" />Основной долг</span><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#26364A]" />Проценты</span></div>
          <details className="mt-6 border-t border-[#26364A]/10 pt-4 text-xs leading-relaxed text-[#6E7886]"><summary className="cursor-pointer font-semibold">Подробности расчёта</summary><div className="mt-3 space-y-2 text-justify">
            <p>{reverse ? result.annualRate === 0 ? "S = A × n" : "S = A × (1 − (1 + i)⁻ⁿ) / i" : result.annualRate === 0 ? "A = S / n" : "A = S × i × (1 + i)ⁿ / ((1 + i)ⁿ − 1)"}</p>
            <p>A - ежемесячный платёж; S - сумма кредита; i - годовая ставка / 12 / 100; n - срок в месяцах.</p>
            <p>Предварительный расчёт без учёта страховок и дополнительных расходов. Не является одобрением банка. {reverse ? "Сумма кредита округляется вниз до копеек, чтобы рассчитанный платёж не превышал указанный." : "Ежемесячный платёж рассчитывается без промежуточного округления."} Суммы отображаются с точностью до копеек.</p>
          </div></details>
        </section>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <section className="min-w-0 rounded-2xl border border-[#D6E2F0] bg-[#EAF2FB] p-5 dark:border-[#405064] dark:bg-[#253241] dark:text-[#E6EDF5]"><h3 className="text-sm font-medium">Переплата</h3><p data-testid="loan-interest" className="mt-3 text-xl font-semibold tabular-nums">{amount(result.interest)}</p><p className="mt-2 text-xs leading-relaxed text-[#6E7886] dark:text-[#B8C4D2]">Общая сумма процентов за весь срок кредита</p></section>
          <section className="min-w-0 rounded-2xl border border-[#D6E2F0] bg-[#EAF2FB] p-5 dark:border-[#405064] dark:bg-[#253241] dark:text-[#E6EDF5]"><h3 className="text-sm font-medium">Общая сумма</h3><p data-testid="loan-total" className="mt-3 text-xl font-semibold tabular-nums">{amount(result.totalPayment)}</p><p className="mt-2 text-xs leading-relaxed text-[#6E7886] dark:text-[#B8C4D2]">Основной долг плюс проценты</p></section>
        </div>
      </> : <section className="rounded-3xl border border-[#EBEEF2] bg-white p-8 text-center"><Calculator className="mx-auto mb-4 size-10 text-[#D68B86]" /><h3 className="text-lg font-semibold">Здесь появятся результаты кредита</h3><p className="mt-3 text-sm leading-relaxed text-[#748195]">{reverse ? "Укажите комфортный ежемесячный платёж, срок и годовую ставку, затем нажмите «Рассчитать»." : "Укажите сумму, срок и годовую ставку, затем нажмите «Рассчитать»."}</p></section>}
    </div>
  </div></div>;
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-wrap justify-between gap-2"><dt className="text-[#6E7886]">{label}</dt><dd className="font-medium tabular-nums">{value}</dd></div>;
}
