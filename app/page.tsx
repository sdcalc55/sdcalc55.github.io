"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { ArrowLeft, ChevronRight, ArrowDownLeft, ArrowUpRight, HousePlus, KeyRound, WalletCards, Calculator, House, Instagram, Sparkles, History, Settings, Trash2, Copy, ChevronDown, type LucideIcon } from "lucide-react";
import { CommissionCalculator } from "@/components/commission-calculator";
import { MortgageCalculators } from "@/components/mortgage-calculators";
import { LegalFooter, LegalSettings } from "@/components/legal-footer";
import { LoanCalculator } from "@/components/loan-calculator";
import type { Operation } from "@/lib/calculator";
import { discounts } from "@/lib/discounts";
import { useTariffs } from "@/hooks/use-tariffs";
import { clearCalculationHistory, clearCalculationKinds, deleteCalculation, getCalculationHistory, getHistoryMode, setHistoryMode, type CalculationKind, type CalculationRecord, type HistoryMode } from "@/lib/history";

const publicAsset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;

type Screen = "home" | "commission" | "mortgage" | "history" | "settings";
type ThemeMode = "light" | "dark" | "system";
const titles = { commission: "Комиссия", mortgage: "Ипотека", history: "История расчётов", settings: "Настройки" };

const historyFieldLabels: Record<string, string> = {
  mode: "Тип расчёта",
  value: "Сумма кредита",
  term: "Срок",
  unit: "Единица срока",
  rate: "Процентная ставка",
  formula: "Формула расчёта",
  motivationPercent: "Процент вознаграждения",
  operation: "Операция",
  category: "Тип недвижимости",
  credit: "Сумма одобренного кредита",
  discountId: "Скидка",
  pairedPrice: "Стоимость второго объекта",
  discount: "Скидка",
  final: "Итоговая комиссия",
  price: "Стоимость недвижимости",
  amount: "Сумма",
  downPayment: "Первоначальный взнос",
  downPaymentPercent: "Первоначальный взнос",
  loanAmount: "Сумма кредита",
  monthlyPayment: "Ежемесячный платёж",
  principal: "Основной долг",
  interest: "Переплата по процентам",
  totalPayment: "Общая сумма",
  months: "Срок",
  annualRate: "Процентная ставка",
  commission: "Комиссия",
  total: "Итого",
  payment: "Платёж",
  propertyPrice: "Стоимость недвижимости",
  purchasePrice: "Стоимость покупки",
  salePrice: "Стоимость продажи",
  "Стоимость объекта, ₽": "Стоимость объекта",
  "Сумма первоначального взноса, ₽": "Сумма первоначального взноса",
  "Первоначальный взнос, %": "Первоначальный взнос",
  "Необходимый первоначальный взнос, %": "Необходимый первоначальный взнос",
  "Стоимость с расчётной корректировкой": "Стоимость с расчётной корректировкой",
};

function historyLabel(key: string) {
  if (historyFieldLabels[key]) return historyFieldLabels[key];
  const readable = key
    .replace(/([a-zа-яё])([A-ZА-ЯЁ])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  const translations: Record<string, string> = {
    formula: "Формула расчёта",
    result: "Результат",
    resultvalue: "Результат расчёта",
    correctedprice: "Скорректированная стоимость объекта",
    adjustedprice: "Скорректированная стоимость объекта",
    downpaymentamount: "Сумма первоначального взноса",
    clientpercent: "Первоначальный взнос клиента",
    missingpercent: "Недостающий процент первоначального взноса",
  };
  return translations[key.toLowerCase().replace(/[ _-]/g, "")] ??
    (readable ? readable.charAt(0).toLocaleUpperCase("ru-RU") + readable.slice(1) : "Параметр расчёта");
}

function historyDuration(value: string, unit: string) {
  const count = Number(value);
  if (!Number.isFinite(count)) return `${value} ${unit === "years" ? "лет" : "месяцев"}`;
  const lastTwo = Math.abs(count) % 100;
  const last = Math.abs(count) % 10;
  if (unit === "years") {
    const word = lastTwo >= 11 && lastTwo <= 14 ? "лет" : last === 1 ? "год" : last >= 2 && last <= 4 ? "года" : "лет";
    return `${value} ${word}`;
  }
  const word = lastTwo >= 11 && lastTwo <= 14 ? "месяцев" : last === 1 ? "месяц" : last >= 2 && last <= 4 ? "месяца" : "месяцев";
  return `${value} ${word}`;
}

function historyDisplayValue(key: string, value: string, params?: Record<string, string>) {
  if (key === "term") return historyDuration(value, params?.unit ?? "months");
  if (key === "months") return historyDuration(value, "months");
  if (["rate", "annualRate", "downPaymentPercent", "motivationPercent", "Первоначальный взнос, %", "Необходимый первоначальный взнос, %"].includes(key)) return value ? (value.endsWith("%") ? value : `${value}%`) : "-";
  const currencyKeys = ["value", "price", "amount", "credit", "pairedPrice", "downPayment", "loanAmount", "propertyPrice", "purchasePrice", "salePrice", "monthlyPayment", "principal", "interest", "totalPayment", "commission", "total", "payment", "final"];
  if (currencyKeys.includes(key) || ["Стоимость объекта, ₽", "Сумма первоначального взноса, ₽"].includes(key)) return (value.includes("₽") ? value : `${value} ₽`).replace(/\s₽/g, "\u00a0₽");
  return historyValue(key, value) || "-";
}

function historyValue(key: string, value: string) {
  if (key === "mode") {
    return ({ principal: "По сумме кредита", payment: "По ежемесячному платежу", total: "По общей сумме выплат" } as Record<string, string>)[value] ?? value;
  }
  if (key === "unit") {
    return ({ years: "лет", months: "месяцев" } as Record<string, string>)[value] ?? value;
  }
  if (key === "operation") {
    return ({ sale: "Продажа", purchase: "Покупка" } as Record<string, string>)[value] ?? "Не указано";
  }
  if (key === "category") {
    return ({ apartment: "Квартира / жилое помещение", house: "Дом", country: "Загородная недвижимость", land: "Земельный участок", commercial: "Коммерческая недвижимость" } as Record<string, string>)[value] ?? "Не указано";
  }
  if (key === "discountId") { const selected = discounts.find(item => item.id === value); return selected ? (selected.paired ? "3%+3%" : `${selected.percent}%`) : "Без скидки"; }
  return value;
}

function NavigationRow({ title, icon: Icon, red, onClick }: { title: string; icon: LucideIcon; red?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`group flex min-h-16 w-full min-w-0 cursor-pointer items-center gap-3 px-4 py-2 text-left transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-[-2px] sm:min-h-[84px] sm:gap-4 sm:px-4 sm:py-5 max-sm:[@media(max-height:650px)]:min-h-14 max-sm:[@media(max-height:650px)]:gap-2 max-sm:[@media(max-height:650px)]:px-3 max-sm:[@media(max-height:650px)]:py-1.5 ${red ? "bg-white hover:bg-[#FFF7F6] focus-visible:outline-[#A72A25] dark:!bg-[#111820] dark:hover:!bg-[#253241]" : "bg-white hover:bg-[#F5F7FA] focus-visible:outline-[#26364A] dark:!bg-[#111820] dark:hover:!bg-[#253241]"} text-[#26364A] dark:text-[#E6ECF3]`}>
    <span className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] border transition-colors sm:size-12 max-sm:[@media(max-height:650px)]:size-9 ${red ? "border-transparent bg-[#FCEBEA] text-[#E83C35] group-hover:bg-[#F9DFDD]" : "border-transparent bg-[#EEF1F5] text-[#26364A] group-hover:bg-[#E4E9F0]"}`}><Icon aria-hidden="true" className="size-[23px] sm:size-6" strokeWidth={1.7} /></span>
    <span className="min-w-0 flex-1 text-sm font-medium leading-5 tracking-normal sm:text-base sm:leading-relaxed max-sm:[@media(max-height:650px)]:text-[13px] max-sm:[@media(max-height:650px)]:leading-[18px]">{title}</span>
    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full transition-colors max-sm:[@media(max-height:650px)]:size-5 text-[#8993A2] group-hover:bg-white group-hover:text-[#26364A]`}><ChevronRight aria-hidden="true" className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5" /></span>
  </button>;
}

export default function Home() {
  const { tariffs, status: tariffStatus } = useTariffs();
  const [screen, setScreen] = useState<Screen>("home");
  const [screenReady, setScreenReady] = useState(false);
  const [operation, setOperation] = useState<Operation>("sale");
  const [mortgageTab, setMortgageTab] = useState<"downpayment" | "loan">("downpayment");
  const [historyItems, setHistoryItems] = useState<CalculationRecord[]>([]);
  const [historyMode, setHistoryModeState] = useState<HistoryMode>("manual");
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [themeReady, setThemeReady] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  useEffect(() => { setIsNativeApp(Capacitor.isNativePlatform()); }, []);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(() => new Set());
  const [historyFilter, setHistoryFilter] = useState<"all" | "commission" | "downpayment" | "loan">("all");
  useEffect(() => { try { const saved = window.sessionStorage.getItem("sd-history-filter"); if (saved === "all" || saved === "commission" || saved === "downpayment" || saved === "loan") setHistoryFilter(saved); } catch {} }, []);
  const filteredHistoryItems = historyItems.filter(item => historyFilter === "all" || (historyFilter === "commission" ? item.kind === "commission" : historyFilter === "downpayment" ? item.kind.startsWith("mortgage-") : item.kind === "loan"));
  const historyGroups = filteredHistoryItems.reduce<{ label: string; items: CalculationRecord[] }[]>((groups, item) => {
    const date = new Date(item.createdAt);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const label = sameDay(date, today) ? "Сегодня" : sameDay(date, yesterday) ? "Вчера" : date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(item); else groups.push({ label, items: [item] });
    return groups;
  }, []);
  useEffect(() => {
    const refresh = () => setHistoryItems(getCalculationHistory());
    refresh(); setHistoryModeState(getHistoryMode());
    const cookieTheme = document.cookie.match(/(?:^|;\s*)sd-theme-mode-v1=(light|dark|system)(?:;|$)/)?.[1];
    let savedTheme: string | null = cookieTheme ?? null;
    if (savedTheme !== "light" && savedTheme !== "dark" && savedTheme !== "system") {
      try { savedTheme = localStorage.getItem("sd-theme-mode-v1"); } catch {}
    }
    const mode: ThemeMode = savedTheme === "light" || savedTheme === "dark" || savedTheme === "system" ? savedTheme : "system";
    setThemeMode(mode);
    setThemeReady(true);
    document.documentElement.classList.toggle("dark", mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches));
    window.addEventListener("sd-history-updated", refresh);
    return () => window.removeEventListener("sd-history-updated", refresh);
  }, []);
  useEffect(() => {
    if (!themeReady) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => {
      if (themeMode === "system") document.documentElement.classList.toggle("dark", media.matches);
    };
    syncSystemTheme();
    if (themeMode !== "system") return;
    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, [themeMode, themeReady]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    let listener: { remove: () => Promise<void> } | undefined;
    App.addListener("backButton", ({ canGoBack }) => {
      if (screen !== "home") {
        // Follow the in-app navigation stack so recalculating from history returns to history.
        if (window.history.state?.sdScreen && window.history.state.sdScreen !== "home") {
          window.history.back();
        } else {
          setScreen("home");
          window.history.replaceState({ ...window.history.state, sdScreen: "home" }, "");
          window.scrollTo({ top: 0, behavior: "instant" });
        }
      } else if (!canGoBack) {
        void App.exitApp();
      } else {
        window.history.back();
      }
    }).then(handle => {
      if (active) listener = handle;
      else void handle.remove();
    });
    return () => {
      active = false;
      if (listener) void listener.remove();
    };
  }, [screen]);
  useEffect(() => {
    // Restore the current section after a browser refresh in the same tab.
    const validScreen = (value: unknown): value is Screen =>
      value === "home" || value === "commission" || value === "mortgage" || value === "history" || value === "settings";
    let restored: Screen = "home";
    const navigationType = window.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    try {
      const saved = window.sessionStorage.getItem("sd-current-screen");
      if (validScreen(saved)) restored = saved;
      const savedOperation = window.sessionStorage.getItem("sd-commission-operation");
      if (savedOperation === "sale" || savedOperation === "purchase") setOperation(savedOperation);
      const savedMortgageTab = window.sessionStorage.getItem("sd-mortgage-tab");
      if (savedMortgageTab === "downpayment" || savedMortgageTab === "loan") setMortgageTab(savedMortgageTab);
    } catch {}
    setScreen(restored);
    setScreenReady(true);
    window.history.replaceState({ ...window.history.state, sdScreen: restored }, "");
    const onBack = (event: PopStateEvent) => {
      const next = validScreen(event.state?.sdScreen) ? event.state.sdScreen : "home";
      setScreen(next);
      try { window.sessionStorage.setItem("sd-current-screen", next); } catch {}
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);
  const navigate = (next: Screen, calculator?: Operation | "downpayment" | "loan") => {
    if (next === "commission") { const nextOperation = calculator === "purchase" ? "purchase" : "sale"; setOperation(nextOperation); try { window.sessionStorage.setItem("sd-commission-operation", nextOperation); } catch {} }
    if (next === "mortgage") { const nextTab = calculator === "loan" ? "loan" : "downpayment"; setMortgageTab(nextTab); try { window.sessionStorage.setItem("sd-mortgage-tab", nextTab); } catch {} }
    if (next !== screen) window.history.pushState({ ...window.history.state, sdScreen: next }, "");
    try { window.sessionStorage.setItem("sd-current-screen", next); } catch {}
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  return <div className={`flex min-h-dvh flex-col bg-[#F5F7FA] text-[#26364A] ${screenReady ? "" : "invisible"}`}>
    <header className="border-b border-[#E7EBF0] bg-white">
      <div className="mx-auto flex min-h-20 max-w-[1200px] flex-nowrap items-center justify-between gap-x-2 px-4 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-4 sm:gap-x-4 sm:px-8 max-sm:min-h-16 max-sm:pt-[calc(.75rem+env(safe-area-inset-top,0px))] max-sm:pb-3">
        <a href="#" onClick={event => { event.preventDefault(); navigate("home"); }} aria-label="Калькулятор SD - главная" className="flex shrink-0 items-center gap-1 rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-[#E83C35] sm:gap-3">
          <span className="flex size-7 shrink-0 select-none items-center justify-center min-[375px]:size-8 sm:size-10" onContextMenu={event => event.preventDefault()} onDragStart={event => event.preventDefault()} style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}><Image src={publicAsset("/images/sd-calculator-logo-transparent.svg")} alt="Логотип SD" width={96} height={96} unoptimized draggable={false} onContextMenu={event => event.preventDefault()} onDragStart={event => event.preventDefault()} className="pointer-events-none size-full object-contain" /></span>
          <span className="whitespace-nowrap text-[13px] font-semibold tracking-tight min-[375px]:text-sm sm:text-[18px]">SvDemidenko</span>
        </a>
        <div className="ml-auto flex shrink-0 items-center gap-2 min-[375px]:gap-2.5 sm:gap-3">
          <div className="flex w-fit items-center gap-1 whitespace-nowrap rounded-full border border-[#F3C7C5] bg-[#FCEBEA] px-2 py-[5px] text-left text-[9px] font-medium leading-[14px] text-[#A94442] min-[375px]:text-[10px] sm:gap-1.5 sm:px-[15px] sm:py-[7.5px] sm:text-[11.25px] sm:leading-[18px]"><Sparkles aria-hidden="true" className="size-2.5 shrink-0 text-[#E83C35] sm:size-3" />Alpha Team</div>
          <button type="button" title="История" aria-label="История" onClick={() => navigate("history")} className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-[#E7EBF0] bg-white text-[#26364A] transition hover:bg-[#F5F7FA] focus-visible:outline-2 focus-visible:outline-[#E83C35] sm:size-10"><History aria-hidden="true" className="size-[17px] sm:size-5" strokeWidth={1.8} /></button>
          <button type="button" title="Настройки" aria-label="Настройки" onClick={() => navigate("settings")} className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-[#E7EBF0] bg-white text-[#26364A] transition hover:bg-[#F5F7FA] focus-visible:outline-2 focus-visible:outline-[#E83C35] sm:size-10"><Settings aria-hidden="true" className="size-[17px] sm:size-5" strokeWidth={1.8} /></button>
        </div>
      </div>
    </header>
    <main className={`mx-auto w-full max-w-[1200px] flex-1 px-5 sm:px-8 ${screen === "home" ? "pb-0 pt-8 sm:pt-10" : "pb-14 pt-3 sm:pt-6"}`}>
      {screen === "home" && <div className="mb-4 text-center sm:mb-6"><h1 className="text-[40px] font-bold tracking-[-0.045em] sm:text-[54px]">Калькулятор <span className="text-[#E83C35]">SD</span></h1><p className="mt-1 text-[13px] text-[#748195] sm:mt-2 sm:text-base">Выберите раздел для расчёта</p></div>}
      {screen !== "home" && <div className="mb-4 flex items-center justify-between gap-3"><button type="button" onClick={() => navigate("home")} className="inline-flex min-h-10 items-center gap-2 rounded-lg py-2 text-sm font-medium text-[#647184] hover:text-[#E83C35] focus-visible:outline-2 focus-visible:outline-offset-4"><ArrowLeft className="size-4" />На главный экран</button><h1 className="text-xl font-semibold tracking-tight sm:text-3xl">{titles[screen]}</h1></div>}
      {screen === "home" && <div className={`mx-auto mt-6 max-w-[900px] space-y-3 sm:mt-8 sm:space-y-6`}>
        <section aria-labelledby="home-commission-title" className="overflow-hidden rounded-2xl !border !border-[#F0DBD9] bg-white shadow-[0_4px_20px_#26364A05] dark:!border-[#405064] dark:bg-[#1B2632]">
          <h2 id="home-commission-title" className={`bg-[#E83C35] px-4 py-2 text-[15px] leading-4 font-semibold tracking-normal text-white sm:px-5 sm:py-3 sm:text-base sm:leading-5`}>Комиссия</h2>
          <div className="bg-white dark:!bg-[#111820]">
            <NavigationRow title="Расчёт комиссии при продаже" icon={HousePlus} red onClick={() => navigate("commission", "sale")} />
            <div className="mr-4 ml-[68px] border-t border-[#EBEEF2] sm:mr-5 sm:ml-[80px]" />
            <NavigationRow title="Расчёт комиссии при покупке" icon={KeyRound} red onClick={() => navigate("commission", "purchase")} />
          </div>
        </section>
        <section aria-labelledby="home-mortgage-title" className="overflow-hidden rounded-2xl !border !border-[#E1E6ED] bg-white shadow-[0_4px_20px_#26364A05] dark:!border-[#405064] dark:bg-[#1B2632]">
          <h2 id="home-mortgage-title" className={`bg-[#26364A] px-4 py-2 text-[15px] leading-4 font-semibold tracking-normal text-white sm:px-5 sm:py-3 sm:text-base sm:leading-5`}>Ипотека</h2>
          <div className="bg-white dark:!bg-[#111820]">
            <NavigationRow title="Расчёт по первоначальному взносу" icon={WalletCards} onClick={() => navigate("mortgage", "downpayment")} />
            <div className="mr-4 ml-[68px] border-t border-[#EBEEF2] sm:mr-5 sm:ml-[80px]" />
            <NavigationRow title="Кредитный калькулятор" icon={Calculator} onClick={() => navigate("mortgage", "loan")} />
          </div>
        </section>
      </div>}
      {screen === "commission" && <div role="group" aria-label="Калькуляторы комиссии" className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-[#E4E8ED] bg-[#EEF1F5] p-1.5">
        {(["sale", "purchase"] as const).map(value => <button key={value} type="button" aria-pressed={operation === value} onClick={() => { setOperation(value); try { window.sessionStorage.setItem("sd-commission-operation", value); } catch {} }} className={`flex min-h-14 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E83C35] sm:text-base ${operation === value ? value === "sale" ? "bg-[#E83C35] text-white shadow-sm" : "bg-[#26364A] text-white shadow-sm dark:bg-[#E83C35]" : "bg-white text-[#647184] hover:bg-[#FFF7F6]"}`}>{value === "sale" ? <ArrowUpRight className="size-5 shrink-0" /> : <ArrowDownLeft className="size-5 shrink-0" />}{value === "sale" ? "Продажа" : "Покупка"}</button>)}
      </div>}
      {screen === "mortgage" && <div role="group" aria-label="Калькуляторы ипотеки" className="mb-4 grid grid-cols-2 gap-1.5 rounded-[14px] border border-[#E4E8ED] bg-[#EEF1F5] p-1 sm:flex sm:gap-2 sm:overflow-x-auto sm:rounded-2xl sm:p-1.5">
        {(["downpayment", "loan"] as const).map(value => <button key={value} type="button" aria-pressed={mortgageTab === value} onClick={() => { setMortgageTab(value); try { window.sessionStorage.setItem("sd-mortgage-tab", value); } catch {} }} className={`flex min-h-[60px] min-w-0 items-center justify-center gap-1.5 text-balance rounded-[10px] px-1.5 py-2 text-sm leading-[19px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26364A] sm:min-h-14 sm:min-w-max sm:flex-1 sm:gap-2 sm:whitespace-nowrap sm:rounded-xl sm:px-4 sm:py-3 sm:text-base ${mortgageTab === value ? value === "downpayment" ? "bg-[#E83C35] text-white shadow-sm" : "bg-[#26364A] text-white shadow-sm dark:bg-[#E83C35]" : "bg-white text-[#647184] hover:bg-[#F7F8FA]"}`}>{value === "downpayment" ? <House className="size-[18px] shrink-0 sm:size-5" /> : <Calculator className="size-[18px] shrink-0 translate-x-1 sm:size-5" />}<span>{value === "downpayment" ? <><span className="sm:hidden">Расчёт по ПВ</span><span className="hidden sm:inline">Расчёт по первоначальному взносу</span></> : "Кредитный калькулятор"}</span></button>)}
      </div>}
      <div id="commission-calculator" hidden={screen !== "commission"}><CommissionCalculator operation={operation} tariffs={tariffs} tariffStatus={tariffStatus} /></div>
      <div id="loan-calculator" hidden={screen !== "mortgage" || mortgageTab !== "loan"}><LoanCalculator /></div>
      <div hidden={screen !== "mortgage" || mortgageTab !== "downpayment"}><MortgageCalculators /></div>
      {screen === "history" && <section className="space-y-5">
        <div role="group" aria-label="Фильтр истории" className="grid grid-cols-4 gap-1.5 rounded-2xl border border-[#E4E8ED] bg-[#EEF1F5] p-1 dark:border-[#405064] dark:bg-[#111820]">{([{value:"all",label:"Все"},{value:"commission",label:"Комиссия"},{value:"downpayment",label:"ПВ"},{value:"loan",label:"Кредит"}] as const).map(option => { const count = historyItems.filter(item => option.value === "all" || (option.value === "commission" ? item.kind === "commission" : option.value === "downpayment" ? item.kind.startsWith("mortgage-") : item.kind === "loan")).length; return <button key={option.value} type="button" aria-pressed={historyFilter === option.value} onClick={() => { setHistoryFilter(option.value); try { window.sessionStorage.setItem("sd-history-filter", option.value); } catch {} }} className={`min-h-10 rounded-xl px-1.5 py-2 text-xs font-semibold transition sm:text-sm ${historyFilter === option.value ? "bg-white text-[#26364A] shadow-sm dark:bg-[#253241] dark:text-[#E6ECF3]" : "text-[#647184] hover:text-[#26364A] dark:text-[#AAB6C5] dark:hover:text-white"}`}>{option.label}</button>; })}</div>
        {historyItems.length > 0 && <div className="flex justify-between gap-3 text-xs text-[#748195]"><span>Записей: {filteredHistoryItems.length}</span><button type="button" onClick={() => { if (historyFilter === "all") { clearCalculationHistory(); setHistoryItems([]); } else { const kinds: CalculationKind[] = historyFilter === "commission" ? ["commission"] : historyFilter === "downpayment" ? ["mortgage-part", "mortgage-whole", "mortgage-adjustment"] : ["loan"]; clearCalculationKinds(kinds); setHistoryItems(getCalculationHistory()); } setExpandedHistory(new Set()); }} disabled={!historyItems.length} className="text-sm text-[#A94442] disabled:opacity-40">{historyFilter === "all" ? "Очистить всю историю" : "Очистить категорию"}</button></div>}
        {historyItems.length === 0 ? <div className="rounded-3xl border border-[#EBEEF2] bg-white p-8 text-center text-sm text-[#748195]">Сохранённых расчётов пока нет</div> : filteredHistoryItems.length === 0 ? <div className="rounded-3xl border border-[#EBEEF2] bg-white p-8 text-center text-sm text-[#748195]">В этой категории пока нет расчётов</div> : historyGroups.map(group => <div key={group.label} className="space-y-2"><h3 className="px-1 text-sm font-semibold text-[#748195]">{group.label}</h3>{group.items.map(item => {
          const isExpanded = expandedHistory.has(item.id);
          const kindLabel = item.kind === "commission" ? "Комиссия" : item.kind === "loan" ? "Кредит" : item.kind === "mortgage-adjustment" ? "Корректировка ПВ" : item.kind === "mortgage-whole" ? "Расчёт бюджета" : "Расчёт по ПВ";
          const subtitle = item.kind === "commission" ? historyValue("category", item.params.category ?? "") : item.kind === "loan" ? (item.params.mode === "payment" ? "По ежемесячному платежу" : "По сумме кредита") : item.kind === "mortgage-whole" ? "По сумме первоначального взноса" : item.kind === "mortgage-adjustment" ? "С учётом взноса клиента" : "По стоимости объекта";
          const primary = item.kind === "commission" ? historyDisplayValue("commission", item.results.commission ?? item.results.final ?? item.summary, item.params) : item.summary.replace(/\s₽/g, "\u00a0₽");
          const secondary = item.kind === "commission" ? `Объект: ${historyDisplayValue("price", item.params.price ?? "", item.params)}` : item.kind.startsWith("mortgage-") ? (item.params["Необходимый первоначальный взнос, %"] ? `Требуемый ПВ: ${historyDisplayValue("Необходимый первоначальный взнос, %", item.params["Необходимый первоначальный взнос, %"])}` : "") : `Ставка: ${historyDisplayValue("rate", item.params.rate ?? "")}`;
          return <article key={item.id} className="overflow-hidden rounded-2xl border border-[#E2E7ED] bg-white shadow-sm dark:border-[#354354] dark:bg-[#1B2632]">
            <button type="button" aria-expanded={isExpanded} onClick={() => setExpandedHistory(current => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} className="flex w-full items-center gap-3 p-4 text-left">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${item.kind === "commission" ? "bg-[#FCEBEA] text-[#C94B45] dark:bg-[#352322] dark:text-[#E69A94]" : item.kind === "loan" ? "bg-[#EAF2FB] text-[#52769D] dark:bg-[#202F40] dark:text-[#91B5DD]" : "bg-[#FAF3E6] text-[#967A3E] dark:bg-[#332D20] dark:text-[#D6BD83]"}`}>{item.kind === "commission" ? <WalletCards className="size-5" /> : item.kind === "loan" ? <Calculator className="size-5" /> : <House className="size-5" />}</span>
               <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-[#26364A] dark:text-[#E6ECF3]">{item.kind.startsWith("mortgage-") ? <><span className="sm:hidden">{item.kind === "mortgage-part" ? "Взнос" : item.kind === "mortgage-whole" ? "Бюджет" : "Частичный ПВ"}</span><span className="hidden sm:inline">{item.title}</span></> : item.title}</span><span className="mt-0.5 block text-xs text-[#748195]">{kindLabel} · {subtitle}</span><span className="mt-1 block text-xs text-[#748195]">{new Date(item.createdAt).toLocaleString("ru-RU")}</span><span className="mt-2 block text-base font-semibold tabular-nums text-[#26364A] dark:text-[#E6ECF3] sm:hidden">{primary}</span>{secondary && <span className="mt-0.5 block text-xs text-[#748195] sm:hidden">{secondary}</span>}</span>
               <span className="hidden min-w-0 text-right sm:block"><strong className="block whitespace-nowrap text-base tabular-nums text-[#26364A] dark:text-[#E6ECF3]">{primary}</strong>{secondary && <span className="mt-1 block text-xs text-[#748195]">{secondary}</span>}</span>
              <ChevronDown className={`size-4 shrink-0 text-[#748195] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
            </button>
            {isExpanded && <div className="border-t border-[#E5EAF0] px-4 pb-4 pt-3 text-sm dark:border-[#354354]">
              <p className="mb-2 font-semibold text-[#26364A] dark:text-[#E6ECF3]">Параметры расчёта</p>
              <div className="divide-y divide-[#EEF1F5] dark:divide-[#354354]">{Object.entries(item.params).filter(([key, value]) => key !== "unit" && key !== "formula" && value !== "").map(([key,value]) => <div key={key} className="flex justify-between gap-3 py-2"><span className="text-[#748195]">{key === "term" ? "Срок" : historyLabel(key).replace(/,\s*[₽%]$/, "")}</span><span className="whitespace-nowrap text-right font-medium text-[#26364A] dark:text-[#E6ECF3]">{historyDisplayValue(key, value, item.params)}</span></div>)}</div>
              <p className="mb-2 mt-4 font-semibold text-[#26364A] dark:text-[#E6ECF3]">Результат</p>
              <div className="rounded-xl bg-[#F4F6F8] p-3 dark:bg-[#111820]">{Object.entries(item.results).filter(([key]) => key !== "formula" && (item.kind !== "commission" || key === "final" || key === "commission") && !(item.kind === "commission" && key === "commission" && item.results.final !== undefined && Number(String(item.results.commission).replace(/[^0-9,.-]/g, "").replace(",", ".")) === Number(String(item.results.final).replace(/[^0-9,.-]/g, "").replace(",", ".")))).map(([key,value]) => <div key={key} className="flex justify-between gap-3 py-1.5"><span className="text-[#748195]">{key === "final" ? "Итоговая комиссия" : historyLabel(key)}</span><span className="whitespace-nowrap text-right font-semibold tabular-nums text-[#26364A] dark:text-[#E6ECF3]">{historyDisplayValue(key, value, item.params)}</span></div>)}</div>
              <div className="mt-4 flex items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-5"><button type="button" onClick={() => { let targetId = "commission-calculator"; if (item.kind === "commission") { navigate("commission", item.params.operation === "purchase" ? "purchase" : "sale"); } else { navigate("mortgage", item.kind === "loan" ? "loan" : "downpayment"); targetId = item.kind === "loan" ? "loan-calculator" : item.kind === "mortgage-part" ? "mortgage-part" : item.kind === "mortgage-whole" ? "mortgage-whole" : "mortgage-adjustment"; } window.dispatchEvent(new CustomEvent("sd-history-restore", { detail: item })); requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: "instant", block: "start" }))); }} className="inline-flex min-h-10 items-center justify-center gap-2 text-sm font-medium text-[#26364A] transition hover:opacity-70 dark:text-[#AAB6C5]"><Calculator className="size-4" />Пересчитать</button><button type="button" onClick={() => { const roundCommissionMoney = (value: string) => { const amount = Number(value.replace(/[^0-9,.-]/g, "").replace(",", ".")); return Number.isFinite(amount) ? `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(amount))}\u00a0₽` : value; }; const lines = item.kind === "commission" ? [`Комиссия: ${roundCommissionMoney(item.results.final ?? item.summary)}`, ...(item.results.fixedPart && Number(item.results.fixedPart.replace(/[^0-9,.-]/g, "").replace(",", ".")) > 0 ? [`Фиксированная часть: ${roundCommissionMoney(item.results.fixedPart)}`] : []), ...(item.results.percentPart && Number(item.results.percentPart.replace(/[^0-9,.-]/g, "").replace(",", ".")) > 0 ? [`${item.results.percentRate ?? ""} от стоимости: ${roundCommissionMoney(item.results.percentPart)}`] : []), ...(item.results.discountSaving ? [`Скидка: ${roundCommissionMoney(item.results.discountSaving)}`] : [])] : Object.entries(item.results).filter(([key]) => key !== "formula").map(([key, value]) => `${historyLabel(key)}: ${historyDisplayValue(key, value, item.params)}`); void navigator.clipboard?.writeText(lines.join("\n")); }} className="inline-flex min-h-10 items-center justify-center gap-2 text-sm font-medium text-[#26364A] transition hover:opacity-70 dark:text-[#AAB6C5]"><Copy className="size-4" />Копировать</button></div><button type="button" onClick={() => { deleteCalculation(item.id); setHistoryItems(getCalculationHistory()); setExpandedHistory(current => { const next = new Set(current); next.delete(item.id); return next; }); }} className="inline-flex min-h-10 items-center gap-2 text-sm text-[#A94442] transition hover:opacity-70"><Trash2 className="size-4" />Удалить</button></div>
            </div>}
          </article>;
        })}</div>)}
      </section>}
      {screen === "settings" && <section className="space-y-5">
        <div><h2 className="mb-3 text-lg font-semibold">История расчётов</h2><div className="rounded-2xl border border-[#EBEEF2] bg-white p-4"><p className="mb-3 font-medium">Сохранение истории</p><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => { setHistoryMode("manual"); setHistoryModeState(getHistoryMode()); }} className={`rounded-xl border px-3 py-3 text-sm font-medium ${historyMode === "manual" ? "border-[#E83C35] bg-[#FCEBEA] text-[#A94442]" : "border-[#E4E8ED]"}`}>Ручное</button><button type="button" onClick={() => { setHistoryMode("auto"); setHistoryModeState(getHistoryMode()); }} className={`rounded-xl border px-3 py-3 text-sm font-medium ${historyMode === "auto" ? "border-[#E83C35] bg-[#FCEBEA] text-[#A94442]" : "border-[#E4E8ED]"}`}>Автоматическое</button></div><p className="mt-2 text-xs text-[#748195]">{historyMode === "manual" ? "Записи создаются по нажатию на закладку." : "Автоматическое сохранение после завершённого расчёта."}</p></div></div>
        <div><h2 className="mb-3 text-lg font-semibold">Внешний вид</h2><div className="rounded-2xl border border-[#EBEEF2] bg-white p-4"><p className="mb-3 font-medium">Тема приложения</p><div className="grid grid-cols-3 gap-2">{([{value:"light",label:"Светлая"},{value:"dark",label:"Тёмная"},{value:"system",label:"Авто"}] as const).map(option => <button key={option.value} type="button" aria-pressed={themeMode === option.value} onClick={() => { try { localStorage.setItem("sd-theme-mode-v1", option.value); } catch {}
            document.cookie = `sd-theme-mode-v1=${option.value}; Path=/; Max-Age=31536000; SameSite=Lax`;
            setThemeMode(option.value); const dark = option.value === "dark" || (option.value === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches); document.documentElement.classList.toggle("dark", dark); }} className={`rounded-xl border px-2 py-3 text-sm font-medium ${themeMode === option.value ? "border-[#E83C35] bg-[#FCEBEA] text-[#A94442]" : "border-[#E4E8ED]"}`}>{option.label}</button>)}</div><p className="mt-2 text-xs text-[#748195]"></p></div></div><div><h2 className="mb-3 text-lg font-semibold">Приложение</h2><div className="rounded-2xl border border-[#EBEEF2] bg-white p-4 text-sm">Версия <span className="float-right text-[#748195]">1.0.0</span></div></div><div className="sm:hidden"><LegalSettings /></div>
      </section>}
    </main>
    <footer className={`mx-auto mt-auto w-full max-w-[1200px] px-5 pb-7 sm:px-8 ${screen === "home" ? "max-sm:pb-[calc(.5rem+env(safe-area-inset-bottom,0px))]" : ""}`}>
      <div className={`flex w-full flex-col items-center justify-center gap-4 border px-4 sm:gap-5 ${screen === "home" ? "mx-auto mt-8 max-w-[900px] !rounded-2xl !border !border-[#E1E6ED] bg-white py-5 max-sm:py-2 sm:mt-20 sm:py-6 dark:!border-[#405064] dark:!bg-[#111820]" : "rounded-3xl border-[#F3DAD8] bg-[#FFF7F6] py-2 sm:py-3"}`}>
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
        <div
          className="relative shrink-0 select-none"
          onContextMenu={event => event.preventDefault()}
          onDragStart={event => event.preventDefault()}
          style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
        >
          <Image src={publicAsset("/images/svdemidenko-portrait.webp")} alt="Портрет SvDemidenko" width={512} height={512} unoptimized draggable={false} onContextMenu={event => event.preventDefault()} onDragStart={event => event.preventDefault()} className={`block aspect-square size-20 shrink-0 rounded-full border-[3px] border-white object-contain object-center shadow-sm sm:size-28 ${screen === "home" ? "max-sm:size-14 max-sm:[@media(max-height:650px)]:size-12" : ""}`} />
        </div>
        <div className="min-w-0 text-left">
          <nav aria-label="Социальные сети" className="flex items-center gap-0 sm:gap-1">
            {[
              { name: "Instagram", href: "https://www.instagram.com/svdemidenko/", icon: "instagram" },
              { name: "MAX", href: "https://max.ru/u/f9LHodD0cOK4HS3ILV9kidFm5zkxzt0iRbfZYiViC9zB7MF8pvVrcAskwJk", icon: "max" },
              { name: "ВКонтакте", href: "https://vk.ru/lanaomsk", icon: "vk" },
              { name: "Telegram", href: "https://t.me/svdemidenko", icon: "telegram" },
            ].map(social => <a key={social.icon} href={social.href} target="_blank" rel="noopener noreferrer" aria-label={social.name} title={social.name} className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[#647184] outline-offset-2 transition-colors hover:bg-white hover:text-[#26364A] focus-visible:outline-2 focus-visible:outline-[#A94442] min-[375px]:size-11"><span className="flex size-7 select-none items-center justify-center" onContextMenu={event => event.preventDefault()} onDragStart={event => event.preventDefault()} style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}>
                {social.icon === "instagram" ? <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/></svg>
                : social.icon === "max" ? <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a9 9 0 0 1 0 18 8.8 8.8 0 0 1-4.6-1.2c-.4-.2-.8-.1-1.1.2-1.3 1.1-3.5 1.7-3.5.3 0-3.1-1.3-4.4-1.3-8.3A10 10 0 0 1 12 3Z"/><path d="M12.1 7.4c-2.7-.1-4.7 1.8-5.1 4.6-.4 2.3.3 5 .8 5.2.3 0 .8-.4 1.2-.8.2-.1.4-.1.5 0a4.8 4.8 0 0 0 2.5.7 4.8 4.8 0 0 0 .1-9.7Z"/></svg>
                : social.icon === "vk" ? <svg aria-hidden="true" viewBox="0 0 512 512" className="size-7" fill="currentColor"><path fillRule="evenodd" d="M 5 100 L 4 161 L 6 179 L 14 216 L 29 256 L 44 284 L 71 321 L 101 351 L 138 378 L 173 396 L 211 409 L 253 417 L 291 417 L 298 409 L 299 315 L 331 328 L 351 342 L 373 366 L 386 387 L 396 412 L 402 417 L 496 418 L 506 411 L 507 398 L 500 377 L 475 329 L 455 303 L 428 276 L 400 254 L 416 241 L 443 213 L 469 174 L 480 149 L 487 122 L 488 103 L 482 95 L 476 93 L 389 94 L 381 105 L 367 141 L 348 169 L 326 190 L 300 205 L 298 204 L 297 100 L 287 93 L 206 93 L 200 95 L 194 104 L 193 289 L 180 279 L 161 258 L 140 221 L 125 174 L 115 100 L 105 93 L 15 93 Z M 33 123 L 89 123 L 92 158 L 102 203 L 112 231 L 129 264 L 147 288 L 171 310 L 191 322 L 212 327 L 216 326 L 223 318 L 224 122 L 269 123 L 269 226 L 271 232 L 276 237 L 282 239 L 314 231 L 330 223 L 351 208 L 369 190 L 386 167 L 408 122 L 455 122 L 456 125 L 450 144 L 432 178 L 415 200 L 395 220 L 361 246 L 358 252 L 358 259 L 366 269 L 401 292 L 433 323 L 457 356 L 472 388 L 419 389 L 396 348 L 369 319 L 335 297 L 291 284 L 275 286 L 269 296 L 268 389 L 240 386 L 211 379 L 180 367 L 154 353 L 122 330 L 100 309 L 81 286 L 62 256 L 50 230 L 39 195 L 33 156 Z"/></svg>
                : <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m21 3-4 18-6-7-8-3L21 3Z"/><path d="m21 3-10 11-1 6 4-3"/></svg>}
              </span></a>)}
          </nav>
        </div>
        </div>
      </div>
      {!isNativeApp && <LegalFooter />}
    </footer>
  </div>;
}
