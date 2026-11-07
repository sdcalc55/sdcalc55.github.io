"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bookmark, Calculator, Copy, Info, RotateCcw, Wallet } from "lucide-react";
import { getCalculationHistory, getHistoryMode, removeCalculationByParams, saveCalculation, upsertCalculationByParams, type CalculationRecord } from "@/lib/history";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { applyDiscount, applyPairedDiscount, discounts } from "@/lib/discounts";
import { DEFAULT_TARIFFS, type TariffSnapshot } from "@/lib/tariffs";
import { calculate, formatInput, parseMoney, type Category, type Operation } from "@/lib/calculator";
import { scrollFocusedInputIntoView } from "@/lib/scroll-focused-input";

const titles: Record<Category, string> = {
  apartment: "Квартира / жилое помещение", country: "Загородная недвижимость", garage: "Гараж / парковочное место", commercial: "Коммерческая недвижимость", land: "Земельный участок с ипотекой на строительство дома",
};
const descriptions: Record<Operation, Partial<Record<Category, string | string[]>>> = {
  sale: {
    apartment: ["Жилое помещение на вторичном рынке", "Квартира в новостройке от дольщика (переуступка доли)"],
    country: ["Объект загородной недвижимости: земельный участок, дом, дача в г. Омске и за его пределами", "Квартира, расположенная за пределами административных границ города Омска", "Переуступка прав аренды земельного участка"],
    garage: "Гаражи и парковочные места", commercial: "Объект коммерческой недвижимости",
  },
  purchase: {
    apartment: ["Жилое помещение на вторичном рынке", "Квартира в новостройке от дольщика (переуступка доли)"],
    country: ["Земельный участок, дом или дача в Омске и за пределами административных границ города на расстоянии до 50 км", "Квартира за пределами административных границ Омска на расстоянии до 50 км"],
    land: "Приобретение земельного участка с условием одобрения кредитной заявки на строительство жилого дома на приобретаемом участке. Объект расположен в Омске или за пределами города на расстоянии до 50 км",
    garage: "Гаражи и парковочные места",
    commercial: "Объекты коммерческой (нежилой) недвижимости, если продавец не является клиентом компании",
  },
};
const numberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 8 });
const money = (n: number) => `${numberFormat.format(n)}\u00a0₽`;

function MoneyInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const invalid = value !== "" && parseMoney(value) === null;
  return <div>
    <label htmlFor={id} className="mb-3 block text-sm font-semibold">{label}</label>
    <div className={`relative rounded-2xl border bg-[#F7F8FA] transition focus-within:border-[#E83C35] focus-within:ring-4 focus-within:ring-[#E83C35]/10 ${invalid ? "border-[#E83C35]" : "border-[#E4E8ED]"}`}>
      <input ref={input} id={id} onFocus={event => scrollFocusedInputIntoView(event.currentTarget)} onClick={event => scrollFocusedInputIntoView(event.currentTarget)} inputMode="decimal" enterKeyHint="done" autoComplete="off" placeholder="Введите стоимость" value={value} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined}
        onKeyDown={event => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.blur(); }
        }}
        onChange={e => {
          const raw = e.target.value;
          const digitsBeforeDecimal = raw.replace(/[ \u00a0\u202f]/g, "").split(/[.,]/)[0].replace(/^0+/, "");
          if (digitsBeforeDecimal.length > 10) return;
          const caret = e.target.selectionStart ?? raw.length;
          const significant = raw.slice(0, caret).replace(/[ \u00a0\u202f]/g, "").length;
          const formatted = formatInput(raw);
          onChange(formatted);
          requestAnimationFrame(() => {
            let position = 0, seen = 0;
            while (position < formatted.length && seen < significant) { if (!/[ \u00a0\u202f]/.test(formatted[position])) seen++; position++; }
            input.current?.setSelectionRange(position, position);
          });
        }} className="h-[68px] w-full rounded-2xl bg-transparent px-5 pr-12 text-lg font-medium tabular-nums outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[#8993A2]" />
      <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-xl text-[#7B8797]">₽</span>
    </div>
    {value !== "" && Number(value.replace(/[\s\u00a0\u202f]/g, "")) > 999999999 ? <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-[#BD302A]">Объект дороже 999 999 999 рублей? Кажется, мы нашли элитную недвижимость! 😄</p> : invalid && <p id={`${id}-error`} className="mt-2 text-sm text-[#BD302A]">Введите корректную сумму.</p>}
  </div>;
}

export function CommissionCalculator({ operation, tariffs }: { operation: Operation; tariffs?: TariffSnapshot; tariffStatus?: string }) {
  type Draft = { category: Category; price: string; credit: string; discountId: string; pairedPrice: string; motivationOpen: boolean; motivationPercent: string };
  const empty: Draft = { category: "apartment", price: "", credit: "", discountId: "none", pairedPrice: "", motivationOpen: false, motivationPercent: "" };
  const [drafts, setDrafts] = useState<Record<Operation, Draft>>({ sale: { ...empty }, purchase: { ...empty } });
  const [draftsRestored, setDraftsRestored] = useState(false);
  useEffect(() => {
    try {
      const isRefresh = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type === "reload" && window.sessionStorage.getItem("sd-current-screen") === "commission";
      const activeOperation = window.sessionStorage.getItem("sd-commission-operation") === "purchase" ? "purchase" : "sale";
      const saved = window.sessionStorage.getItem("sd-commission-drafts");
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Record<Operation, Draft>>;
        if (isRefresh) delete parsed[activeOperation];
        setDrafts(previous => ({ sale: { ...previous.sale, ...(parsed.sale ?? {}) }, purchase: { ...previous.purchase, ...(parsed.purchase ?? {}) } }));
        if (isRefresh) window.sessionStorage.setItem("sd-commission-drafts", JSON.stringify(parsed));
      }
    } catch {}
    setDraftsRestored(true);
  }, []);
  useEffect(() => {
    if (!draftsRestored) return;
    try { window.sessionStorage.setItem("sd-commission-drafts", JSON.stringify(drafts)); } catch {}
  }, [drafts, draftsRestored]);
  const { category, price, credit, discountId, pairedPrice, motivationOpen, motivationPercent } = drafts[operation];
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDrafts(previous => ({ ...previous, [operation]: { ...previous[operation], [key]: value } }));
  const setCategory = (value: Category) => update("category", value);
  const setPrice = (value: string) => update("price", value);
  const setCredit = (value: string) => update("credit", value);
  const setDiscountId = (value: string) => update("discountId", value);
  const setPairedPrice = (value: string) => update("pairedPrice", value);
  const sale = operation === "sale";
  const result = calculate(operation, category, parseMoney(price), parseMoney(credit), tariffs);
  const categories: Category[] = sale ? ["apartment", "country", "garage", "commercial"] : ["apartment", "country", "land", "garage", "commercial"];
  const availableDiscounts = category === "commercial" ? [] : discounts.filter(item => !item.operations || item.operations.includes(operation));
  const discount = availableDiscounts.find(item => item.id === discountId);
  const pairedResult = discount?.paired ? calculate(sale ? "purchase" : "sale", category === "land" ? "country" : category, parseMoney(pairedPrice), null, tariffs) : null;
  const pairedDiscounted = result.status === "ok" && pairedResult?.status === "ok" ? applyPairedDiscount(result.total, pairedResult.total) : null;
  const discounted = result.status !== "ok" ? null : discount?.paired ? pairedDiscounted : applyDiscount(result.total, discount?.percent ?? 0);
  const normalizedPercent = motivationPercent.trim().replace(",", ".");
  const motivation = /^\d+(?:\.\d+)?$/.test(normalizedPercent) ? Number(normalizedPercent) : NaN;
  const motivationValid = Number.isFinite(motivation) && motivation >= 0 && motivation <= 99;
  const motivationAmount = discounted && motivationValid ? Math.round((discounted.total * motivation / 100 + Number.EPSILON) * 100) / 100 : null;
  const clear = () => { setPrice(""); setCredit(""); setDiscountId("none"); setPairedPrice(""); update("motivationPercent", ""); update("motivationOpen", false); };
  const [savedKey, setSavedKey] = useState("");
  const [dismissedKey, setDismissedKey] = useState("");
  const [historyModeVersion, setHistoryModeVersion] = useState(0);
  useEffect(() => { const update = () => setHistoryModeVersion(v => v + 1); window.addEventListener("sd-history-settings-updated", update); return () => window.removeEventListener("sd-history-settings-updated", update); }, []);
  useEffect(() => {
    const restore = (event: Event) => {
      const record = (event as CustomEvent<CalculationRecord>).detail;
      if (record?.kind !== "commission") return;
      const p = record.params;
      const target = p.operation === "purchase" ? "purchase" : "sale";
      setDrafts(previous => ({ ...previous, [target]: {
        category: (p.category || "apartment") as Category, price: p.price || "", credit: p.credit || "",
        discountId: p.discountId || "none", pairedPrice: p.pairedPrice || "", motivationOpen: Boolean(p.motivationPercent),
        motivationPercent: p.motivationPercent || ""
      }}));
    };
    window.addEventListener("sd-history-restore", restore);
    return () => window.removeEventListener("sd-history-restore", restore);
  }, []);
  useEffect(() => {
    if (getHistoryMode() !== "auto" || result.status !== "ok" || !discounted) return;
    const params = { operation, category, price, credit, discountId, pairedPrice, motivationPercent };
    const key = JSON.stringify(params);
    if (savedKey === key || dismissedKey === key) return;
    const timer = window.setTimeout(() => {
      upsertCalculationByParams({ kind: "commission", title: `Комиссия - ${sale ? "Продажа" : "Покупка"}`, summary: money(discounted.total), params, results: { commission: money(result.total), final: money(discounted.total), discount: discount?.name ?? "Без скидки" } });
      setSavedKey(key);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [operation, category, price, credit, discountId, pairedPrice, motivationPercent, result.status, result.status === "ok" ? result.total : 0, discounted?.total, savedKey, dismissedKey, sale, discount?.name, historyModeVersion]);

  const currentParams = { operation, category, price, credit, discountId, pairedPrice, motivationPercent };
  const currentKey = JSON.stringify(currentParams);
  useEffect(() => {
    const syncSavedState = () => {
      const exists = getCalculationHistory().some(item => item.kind === "commission" && JSON.stringify(item.params) === JSON.stringify(currentParams));
      setSavedKey(exists ? currentKey : "");
    };
    syncSavedState();
    window.addEventListener("sd-history-updated", syncSavedState);
    return () => window.removeEventListener("sd-history-updated", syncSavedState);
  }, [currentKey, operation, category, price, credit, discountId, pairedPrice, motivationPercent]);
  const isSaved = savedKey === currentKey;
  const save = () => {
    if (result.status !== "ok" || !discounted) return;
    if (isSaved) {
      removeCalculationByParams("commission", currentParams);
      setSavedKey("");
      setDismissedKey(currentKey);
      return;
    }
    saveCalculation({ kind: "commission", title: `Комиссия - ${sale ? "Продажа" : "Покупка"}`, summary: money(discounted.total), params: currentParams, results: { commission: money(result.total), final: money(discounted.total), fixedPart: money(result.fixed), percentPart: money(result.percent), percentRate: `${numberFormat.format(result.rate * 100)}%`, ...(discounted.saving > 0 ? { discountSaving: money(discounted.saving) } : {}), discount: discount?.name ?? "Без скидки" } });
    setSavedKey(currentKey);
    setDismissedKey("");
    toast.success("Расчёт сохранён в истории");
  };
  const copy = async () => {
    if (result.status !== "ok" || !discounted) return;
    try { const roundedMoney = (value: number) => money(Math.round(value)); const breakdown = [...(result.fixed > 0 && (result.rate > 0 || discounted.saving > 0) ? [roundedMoney(result.fixed)] : []), ...(result.rate > 0 ? [`${numberFormat.format(result.rate * 100)}% от стоимости: ${roundedMoney(result.percent)}`] : []), ...(discounted.saving > 0 ? [`Скидка: ${roundedMoney(discounted.saving)}`] : [])]; const copied = `Комиссия: ${roundedMoney(discounted.total)}${breakdown.length ? ` (${breakdown.join(" + ").replace(/ \+ Скидка:/, ", Скидка:")})` : ""}`; await navigator.clipboard.writeText(copied); toast.success("Скопировано в буфер обмена"); }
    catch { toast.error("Не удалось скопировать сумму. Выделите и скопируйте её вручную."); }
  };
  return <><div className="grid items-start gap-6 lg:grid-cols-[1.12fr_1fr]">
        <section aria-labelledby="form-title" className="rounded-3xl border border-[#EBEEF2] bg-white p-6 shadow-[0_3px_18px_#26364A03] sm:p-8">
          <div className="mb-6 flex items-start gap-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#FCEBEA] text-[#E83C35]"><Calculator className="size-[22px]" /></span>
            <div><h2 id="form-title" className="text-xl font-semibold leading-snug tracking-tight">Рассчитать комиссию при {sale ? "продаже" : "покупке"}</h2><p className="mt-2 select-none text-sm leading-relaxed text-[#748195] dark:text-[#B8C4D2]">Выберите тип недвижимости и укажите её стоимость</p></div>
          </div>
          <div>
            <label htmlFor="category" className="mb-3 block text-sm font-semibold">Что {sale ? "продаём" : "покупаем"}?</label>
            <Select value={category} onValueChange={(value) => { setCategory(value as Category); clear(); }}>
              <SelectTrigger id="category" className={`h-auto! min-h-[52px] w-full rounded-xl border bg-[#F7F8FA] px-4 py-3 text-sm shadow-none [&_[data-slot=select-value]]:line-clamp-none [&_[data-slot=select-value]]:text-left [&_[data-slot=select-value]]:whitespace-normal ${sale ? "focus-visible:border-[#E83C35] focus-visible:ring-[#E83C35]/15" : "focus-visible:border-[#26364A] focus-visible:ring-[#26364A]/15"}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] min-w-0 rounded-xl dark:border-[#405064] dark:bg-[#253241] dark:text-[#E6EDF5]">
                {categories.map(item => <SelectItem key={item} value={item} className="cursor-pointer whitespace-normal py-3 text-sm">{titles[item]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="mb-7 mt-4 flex items-start gap-2.5 rounded-xl bg-[#EAF2FB]/65 p-3.5 text-xs leading-[1.7] text-[#536A84] dark:border dark:border-[#405064] dark:bg-[#263648] dark:text-[#D6E0EA]"><Info className="mt-0.5 size-4 shrink-0" />{Array.isArray(descriptions[operation][category]) ? <ul className="min-w-0 list-disc space-y-1 pl-4">{(descriptions[operation][category] as string[]).map(item => <li key={item}>{item}</li>)}</ul> : <p>{descriptions[operation][category]}</p>}</div>
          <div className="space-y-5">
            <MoneyInput id="price" label={category === "land" ? "Стоимость земельного участка, ₽" : "Стоимость объекта недвижимости, ₽"} value={price} onChange={setPrice} />
            {category === "land" && <MoneyInput id="credit" label="Сумма одобренного кредита на строительство, ₽" value={credit} onChange={setCredit} />}
            {category !== "commercial" && <div>
              <label htmlFor="discount" className="mb-3 block text-sm font-semibold">Скидка</label>
              <Select value={discount?.id ?? "none"} onValueChange={value => { setDiscountId(value); setPairedPrice(""); }}>
                <SelectTrigger id="discount" className="h-auto! min-h-[52px] w-full rounded-xl border border-[#E4E8ED] bg-[#F7F8FA] px-4 py-3 text-sm shadow-none [&_[data-slot=select-value]]:line-clamp-none [&_[data-slot=select-value]]:whitespace-normal [&_[data-slot=select-value]]:text-left"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" className="max-h-80 w-[var(--radix-select-trigger-width)] min-w-0 rounded-xl dark:border-[#405064] dark:bg-[#253241] dark:text-[#E6EDF5]">
                  <SelectItem value="none" className="py-3 text-sm">Скидка не применена</SelectItem>
                  {availableDiscounts.map(item => <SelectItem key={item.id} value={item.id} className="cursor-pointer whitespace-normal py-3 text-sm">{item.name} - {item.paired ? "3%+3%" : `${item.percent}%`}</SelectItem>)}
                </SelectContent>
              </Select>
              {discount && <div data-testid="discount-details" className="mt-3 space-y-3 rounded-xl bg-[#EAF2FB]/65 p-3.5 text-xs leading-relaxed text-[#536A84] dark:border dark:border-[#405064] dark:bg-[#263648] dark:text-[#D6E0EA]">
                <p><span className="font-semibold">Примечание: </span>{discount.note}</p>
              </div>}
            </div>}
            {discount?.paired && <MoneyInput id="paired-price" label={sale ? "Стоимость ранее приобретаемой недвижимости, ₽" : "Стоимость ранее продаваемой недвижимости, ₽"} value={pairedPrice} onChange={setPairedPrice} />}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <span className="flex select-none items-center gap-1.5 text-xs text-[#748195] dark:text-[#B8C4D2]"><span className="size-1.5 rounded-full bg-[#84A992]" />Автоматический расчёт</span>
            <button onClick={clear} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E83C35]/25 bg-[#FFF1F0] px-3 py-1.5 text-[13px] font-semibold text-[#C94B45] shadow-sm transition hover:border-[#E83C35]/50 hover:bg-[#FCE5E3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E83C35] dark:border-[#8D4845] dark:bg-[#3A292B] dark:text-[#F0A09A] dark:hover:bg-[#493033]"><RotateCcw className="size-3" />Сбросить</button>
          </div>
        </section>
        <div className="space-y-4">
          <section aria-label="Комиссия" className={`overflow-hidden rounded-3xl border ${sale ? "border-[#F1DCD9] bg-[#FCEBEA]" : "border-[#DEE4EB] bg-[#EEF1F5]"}`}>
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold tracking-tight">Комиссия</h2><button type="button" onClick={save} disabled={!discounted} aria-label={isSaved ? "Убрать комиссию из истории" : "Сохранить комиссию в историю"} title={isSaved ? "Убрать из истории" : "Сохранить в историю"} className={`flex size-9 items-center justify-center rounded-full border border-[#E83C35]/20 bg-white/70 transition-colors disabled:opacity-40 ${isSaved ? "text-[#E83C35]" : "text-[#647184] hover:text-[#E83C35]"}`}><Bookmark aria-hidden="true" className="size-5" fill={isSaved ? "currentColor" : "none"} /></button></div>
              <div aria-live="polite" aria-atomic="true">
                {result.status === "ok" ? <>
                  <div className="mb-2 mt-5 flex flex-wrap items-center gap-3"><p data-testid="total" className="text-[42px] font-semibold leading-tight tracking-[-0.04em] text-[#E83C35] tabular-nums sm:text-[50px]">{discounted ? money(discounted.total) : "-"}</p><span className="inline-flex shrink-0 items-center gap-1"><button onClick={copy} disabled={!discounted} aria-label="Скопировать итоговую сумму" title="Скопировать итоговую сумму" className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-[#647184] outline-offset-2 hover:bg-white/60 focus-visible:outline-2"><Copy aria-hidden="true" className="size-5" /></button><button type="button" onClick={() => update("motivationOpen", !motivationOpen)} disabled={!discounted} aria-label="Рассчитать вознаграждение риелтора" title="Рассчитать вознаграждение риелтора" aria-expanded={motivationOpen} aria-controls="motivation-panel" className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl outline-offset-2 hover:bg-white/60 focus-visible:outline-2 disabled:opacity-40 ${motivationOpen ? "bg-white/65 text-[#E83C35]" : "text-[#647184]"}`}><Wallet aria-hidden="true" className="size-5" /></button></span></div>
                  <p className="text-xs text-[#6E7886] dark:text-[#B8C4D2]">Комиссия со скидкой, округлённая до рубля</p>
                  {motivationOpen && discounted && <div id="motivation-panel" className="mt-4 rounded-2xl border border-white/80 bg-white/75 p-4 sm:p-5">
                    <div className="mb-4 flex items-center gap-2 text-sm font-semibold"><Wallet aria-hidden="true" className="size-4 text-[#647184]" />Агентское вознаграждение</div>
                    <label htmlFor="motivation-percent" className="mb-2 block text-sm font-semibold">Ваш партнерский процент</label>
                    <div className="relative max-w-48"><input id="motivation-percent" autoFocus onFocus={event => scrollFocusedInputIntoView(event.currentTarget)} onClick={event => scrollFocusedInputIntoView(event.currentTarget)} inputMode="decimal" enterKeyHint="done" autoComplete="off" placeholder="Например, 43.5" value={motivationPercent} onChange={event => {
                       const raw = event.target.value.replace(",", ".").replace(/[^\d.]/g, "");
                       const parts = raw.split(".");
                       const candidate = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : raw;
                        if (candidate.split(".")[0].length > 3) return;
                       const numeric = Number(candidate);
                       update("motivationPercent", candidate);
                     }} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.blur(); } }} aria-invalid={motivation > 99} aria-describedby={motivation > 99 ? "motivation-hint" : undefined} className="h-12 w-full rounded-xl border border-[#E4E8ED] bg-white px-4 pr-10 text-lg font-medium tabular-nums outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[#8993A2] focus:border-[#E83C35] focus:ring-4 focus:ring-[#E83C35]/10" /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#748195]">%</span></div>
                    {motivation > 99 && <p id="motivation-hint" className="mt-2 text-xs leading-relaxed text-[#BD302A]">Больше 99%? Кажется, с партнёрством что-то пошло не так! 😉</p>}
                    <div className="mt-4 border-t border-[#26364A]/10 pt-4"><p className="text-xs text-[#647184]">От итоговой комиссии с учётом скидки</p><p data-testid="motivation-amount" className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-[#26364A]">{motivationAmount === null ? "-" : money(motivationAmount)}</p>{motivationAmount !== null && <p className="mt-2 text-xs leading-relaxed text-[#748195] dark:text-[#B8C4D2]"><span className="whitespace-nowrap">{money(discounted.total)}</span> × {motivationPercent}%</p>}</div>
                  </div>}
                  {discount && !discount.paired && <div data-testid="discount-applied" className="mt-4 space-y-2 rounded-xl bg-white/65 p-4 text-sm leading-relaxed">
                    <p className="font-semibold text-[#A94442]">Применена скидка: {discount.name} - {discount.percent}%</p>
                    <p>Комиссия без скидки: <span className="whitespace-nowrap">{money(result.total)}</span></p>
                    {discounted && <p>Скидка: <span data-testid="discount-saving" className="whitespace-nowrap">{money(discounted.saving)}</span></p>}
                  </div>}
                  {discount?.paired && <div data-testid="discount-applied" className="mt-4 space-y-3 rounded-xl bg-white/65 p-4 text-sm leading-relaxed">
                    <div className="space-y-1 font-semibold text-[#A94442]">
                      <p>Применена скидка:</p>
                      <p>За встречную сделку: продажа + покупка в одном городе - 3%+3%</p>
                    </div>
                    <p>Комиссия без скидки: <span className="whitespace-nowrap">{money(result.total)}</span></p>
                    {pairedResult?.status === "ok" && pairedDiscounted ? <>
                      <p>Комиссия предыдущей сделки: <span className="whitespace-nowrap">{money(pairedResult.total)}</span></p>
                      <div className="space-y-3 pt-3">
                        <p>3% от текущей комиссии: <span data-testid="current-saving" className="whitespace-nowrap">{money(pairedDiscounted.currentSaving)}</span></p>
                        <p>3% от предыдущей комиссии: <span data-testid="previous-saving" className="whitespace-nowrap">{money(pairedDiscounted.previousSaving)}</span></p>
                      </div>
                      <p className="border-t border-[#26364A]/10 pt-3 font-semibold">Общая скидка: <span data-testid="combined-saving" className="whitespace-nowrap">{money(pairedDiscounted.saving)}</span></p>
                    </> : <p className="text-[#647184]">{pairedResult?.status === "undefined" ? "Для указанной стоимости тариф не определён. Уточните размер комиссии" : "Укажите стоимость встречного объекта для расчёта итоговой комиссии"}</p>}
                  </div>}
                  <div className="mt-7 border-t border-[#26364A]/10 pt-5">
                    <dl className="space-y-3 text-sm">
                      <Row label="Операция" value={sale ? "Продажа" : "Покупка"} />
                      <Row label="Тип недвижимости" value={titles[category]} />
                      <Row label={category === "land" ? "Стоимость участка" : "Стоимость объекта"} value={money(parseMoney(price)!)} />
                      {category === "land" && <><Row label="Одобренный кредит" value={money(parseMoney(credit)!)} /><Row label="Общая база" value={money(result.base)} /></>}
                      <div className="border-t border-[#26364A]/10" />
                      <Row label="Фиксированная часть" value={money(result.fixed)} />
                      {result.rate > 0 && <><Row label="Процентная часть" value={`${numberFormat.format(result.rate * 100)} % × ${money(result.base)}`} /><Row label="Сумма процентной части" value={money(result.percent)} /></>}
                    </dl>
                    <details className="mt-3 border-t border-[#26364A]/10 pt-3 text-xs leading-relaxed text-[#6E7886] dark:text-[#AAB6C5]">
                      <summary className="cursor-pointer font-semibold">Подробности расчёта</summary>
                      <div className="mt-2 space-y-3">
                        {!discount && result.rate === 0 && result.fixed > 0 ? <p><strong>Размер агентского вознаграждения</strong> при стоимости объекта недвижимости до <strong>{(() => { const rule = (tariffs?.rules ?? DEFAULT_TARIFFS.rules).find(item => item.operation === operation && item.category === category && parseMoney(price) !== null && parseMoney(price)! >= item.from && (item.to === null || parseMoney(price)! <= item.to)); return rule?.to !== null && rule?.to !== undefined ? numberFormat.format(Math.floor(rule.to) + 1) : "установленного тарифом значения"; })()}</strong> рублей составляет <strong>{numberFormat.format(result.fixed)}</strong> рублей.</p> : result.fixed > 0 && <p>Фиксированная часть: <span className="whitespace-nowrap">{money(result.fixed)}</span></p>}
                        {result.rate > 0 && <p>Процентная часть: <span className="whitespace-nowrap">{money(result.base)}</span> × {numberFormat.format(result.rate * 100)}% = <span className="whitespace-nowrap">{money(result.percent)}</span></p>}
                        {(result.fixed > 0 && result.rate > 0) && <p>Комиссия без скидки: <span className="whitespace-nowrap">{money(result.fixed)}</span> + <span className="whitespace-nowrap">{money(result.percent)}</span> = <span className="whitespace-nowrap">{money(result.calculated)}</span></p>}
                        {result.minimumApplied && (category === "country" ? <p className="font-semibold">Применено минимальное агентское вознаграждение - 60 000 рублей</p> : <p className="font-semibold">Применена минимальная комиссия: <span className="whitespace-nowrap">{money(result.total)}</span></p>)}
                        {discount && discounted && (discount.paired ? <>
                          <div className="border-t border-[#26364A]/10 pt-3">
                            <p>Скидка по текущей сделке 3%: <span className="whitespace-nowrap">{money(result.total)}</span> × 3% = <span className="whitespace-nowrap">{money(pairedDiscounted?.currentSaving ?? 0)}</span></p>
                            {pairedResult?.status === "ok" && pairedDiscounted && <p className="mt-2">Скидка по встречной сделке 3%: <span className="whitespace-nowrap">{money(pairedResult.total)}</span> × 3% = <span className="whitespace-nowrap">{money(pairedDiscounted.previousSaving)}</span></p>}
                            <p className="mt-2">Общая скидка: <span className="whitespace-nowrap">{money(discounted.saving)}</span></p>
                            <p className="mt-2 font-semibold">Итоговая комиссия: <span className="whitespace-nowrap">{money(result.total)}</span> - <span className="whitespace-nowrap">{money(discounted.saving)}</span> = <span className="whitespace-nowrap">{money(discounted.total)}</span></p>
                          </div>
                        </> : <>
                          <div className="border-t border-[#26364A]/10 pt-3">
                            <p>Скидка {discount.percent}%: <span className="whitespace-nowrap">{money(result.total)}</span> × {discount.percent}% = <span className="whitespace-nowrap">{money(discounted.saving)}</span></p>
                            <p className="mt-2 font-semibold">Итоговая комиссия: <span className="whitespace-nowrap">{money(result.total)}</span> - <span className="whitespace-nowrap">{money(discounted.saving)}</span> = <span className="whitespace-nowrap">{money(discounted.total)}</span></p>
                          </div>
                        </>)}
                        
                      </div>
                    </details>
                  </div>
                </> : result.status === "undefined" ? <div className="py-12"><Info className="mb-4 size-8 text-[#647184]" /><p className="text-lg font-medium leading-relaxed dark:text-[#E6EDF5]">Для указанной стоимости тариф не определён. Уточните размер комиссии</p></div> : <div className="flex min-h-[300px] select-none flex-col items-center justify-center text-center">
                  <div className="relative mb-5 flex size-[76px] items-center justify-center rounded-[22px] border border-white/90 bg-white/65"><Calculator className={`size-9 stroke-[1.3] ${sale ? "text-[#D68B86]" : "text-[#7B8797]"}`} /><span className={`absolute -bottom-1.5 -right-1.5 flex size-7 items-center justify-center rounded-full border-4 bg-white ${sale ? "border-[#FCEBEA]" : "border-[#EEF1F5]"}`}><span className={`text-sm ${sale ? "text-[#D68B86]" : "text-[#7B8797]"}`}>₽</span></span></div>
                  <p className="text-lg font-semibold">Здесь появится ваша комиссия</p><p className="mt-2 max-w-[285px] text-sm leading-relaxed text-[#737D8D]">{category === "land" ? "Укажите стоимость участка и сумму одобренного кредита - мы рассчитаем вознаграждение" : "Укажите стоимость объекта - мы автоматически рассчитаем вознаграждение"}</p>
                </div>}
              </div>
            </div>
          </section>
        </div>
      </div></>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-5"><dt className="shrink-0 text-[#6E7886]">{label}</dt><dd className="max-w-[65%] text-right font-medium leading-relaxed tabular-nums">{value}</dd></div>;
}
