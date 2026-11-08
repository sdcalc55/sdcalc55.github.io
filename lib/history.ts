"use client";

export type CalculationKind = "commission" | "mortgage-part" | "mortgage-whole" | "mortgage-adjustment" | "loan";
export type CalculationRecord = {
  id: string;
  kind: CalculationKind;
  title: string;
  createdAt: string;
  summary: string;
  params: Record<string, string>;
  results: Record<string, string>;
};

export type HistoryMode = "manual" | "auto";
const STORAGE_KEY = "sd-calculation-history-v1";
const MODE_KEY = "sd-calculation-history-mode-v1";
export const HISTORY_LIMIT = 15;

export function getCalculationHistory(): CalculationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed as CalculationRecord[] : [];
  } catch { return []; }
}

export function saveCalculation(record: Omit<CalculationRecord, "id" | "createdAt">, replaceLatestOfKind = false, replaceMatchingParam?: { key: string; value: string }): CalculationRecord {
  const entry: CalculationRecord = { ...record, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString() };
  const existing = getCalculationHistory();
  const sameKind = existing.filter(item => item.kind === entry.kind);
  const otherKinds = existing.filter(item => item.kind !== entry.kind);
  const next = replaceLatestOfKind
    ? [entry]
    : replaceMatchingParam
      ? [...sameKind.filter(item => item.params[replaceMatchingParam.key] !== replaceMatchingParam.value), entry].slice(-HISTORY_LIMIT)
      : [...sameKind, entry].slice(-HISTORY_LIMIT);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...otherKinds, ...next].sort((a, b) => b.createdAt.localeCompare(a.createdAt))));
  window.dispatchEvent(new CustomEvent("sd-history-updated"));
  return entry;
}

export function upsertCalculationByParams(record: Omit<CalculationRecord, "id" | "createdAt">): CalculationRecord {
  const entry: CalculationRecord = { ...record, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString() };
  const matches = (candidate: Record<string, string>) => Object.keys(record.params).length === Object.keys(candidate).length && Object.entries(record.params).every(([key, value]) => candidate[key] === value);
  const existing = getCalculationHistory();
  const sameKind = existing.filter(item => item.kind === entry.kind && !matches(item.params));
  const otherKinds = existing.filter(item => item.kind !== entry.kind);
  const next = [...sameKind, entry].slice(-HISTORY_LIMIT);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...otherKinds, ...next].sort((a, b) => b.createdAt.localeCompare(a.createdAt))));
  window.dispatchEvent(new CustomEvent("sd-history-updated"));
  return entry;
}

export function deleteCalculation(id: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getCalculationHistory().filter(item => item.id !== id)));
  window.dispatchEvent(new CustomEvent("sd-history-updated"));
}

export function removeCalculationByParams(kind: CalculationKind, params: Record<string, string>) {
  const matches = (candidate: Record<string, string>) => Object.keys(params).length === Object.keys(candidate).length && Object.entries(params).every(([key, value]) => candidate[key] === value);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getCalculationHistory().filter(item => item.kind !== kind || !matches(item.params))));
  window.dispatchEvent(new CustomEvent("sd-history-updated"));
}

export function removeCalculationByKind(kind: CalculationKind) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getCalculationHistory().filter(item => item.kind !== kind)));
  window.dispatchEvent(new CustomEvent("sd-history-updated"));
}

export function clearCalculationKinds(kinds: CalculationKind[]) {
  const selected = new Set(kinds);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getCalculationHistory().filter(item => !selected.has(item.kind))));
  window.dispatchEvent(new CustomEvent("sd-history-updated"));
}

export function clearCalculationHistory() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("sd-history-updated"));
}

export function getHistoryMode(): HistoryMode {
  if (typeof window === "undefined") return "manual";
  return localStorage.getItem(MODE_KEY) === "auto" ? "auto" : "manual";
}

export function setHistoryMode(mode: HistoryMode) {
  localStorage.setItem(MODE_KEY, mode);
  window.dispatchEvent(new CustomEvent("sd-history-settings-updated"));
}
