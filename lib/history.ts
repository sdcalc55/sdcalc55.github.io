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
const VALID_KINDS = new Set<CalculationKind>(["commission", "mortgage-part", "mortgage-whole", "mortgage-adjustment", "loan"]);
const MAX_RECORDS = HISTORY_LIMIT * VALID_KINDS.size;
const MAX_FIELD_LENGTH = 500;
const isPlainStringMap = (value: unknown): value is Record<string, string> =>
  !!value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length <= 30 &&
  Object.entries(value).every(([key, item]) => key.length <= 100 && typeof item === "string" && item.length <= MAX_FIELD_LENGTH);

export function isValidCalculationRecord(value: unknown): value is CalculationRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && item.id.length > 0 && item.id.length <= 100 &&
    typeof item.kind === "string" && VALID_KINDS.has(item.kind as CalculationKind) &&
    typeof item.title === "string" && item.title.length > 0 && item.title.length <= 160 &&
    typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt)) &&
    typeof item.summary === "string" && item.summary.length <= MAX_FIELD_LENGTH &&
    isPlainStringMap(item.params) && isPlainStringMap(item.results);
}

function readStorage(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writeStorage(key: string, value: string): boolean {
  try { window.localStorage.setItem(key, value); return true; } catch { return false; }
}
function removeStorage(key: string): boolean {
  try { window.localStorage.removeItem(key); return true; } catch { return false; }
}
function notifyHistoryChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("sd-history-updated"));
}

export function getCalculationHistory(): CalculationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = readStorage(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      removeStorage(STORAGE_KEY);
      return [];
    }
    const valid = parsed.filter(isValidCalculationRecord)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const counts = new Map<CalculationKind, number>();
    const limited = valid.filter(item => {
      const count = counts.get(item.kind) ?? 0;
      if (count >= HISTORY_LIMIT) return false;
      counts.set(item.kind, count + 1);
      return true;
    }).slice(0, MAX_RECORDS);
    if (limited.length !== parsed.length) writeStorage(STORAGE_KEY, JSON.stringify(limited));
    return limited;
  } catch {
    removeStorage(STORAGE_KEY);
    return [];
  }
}

export function saveCalculation(record: Omit<CalculationRecord, "id" | "createdAt">, replaceLatestOfKind = false, replaceMatchingParam?: { key: string; value: string }): CalculationRecord {
  const entry: CalculationRecord = { ...record, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString() };
  if (!isValidCalculationRecord(entry)) return entry;
  const existing = getCalculationHistory();
  const sameKind = existing.filter(item => item.kind === entry.kind);
  const otherKinds = existing.filter(item => item.kind !== entry.kind);
  const next = replaceLatestOfKind
    ? [entry]
    : replaceMatchingParam
      ? [...sameKind.filter(item => item.params[replaceMatchingParam.key] !== replaceMatchingParam.value), entry].slice(-HISTORY_LIMIT)
      : [...sameKind, entry].slice(-HISTORY_LIMIT);
  if (writeStorage(STORAGE_KEY, JSON.stringify([...otherKinds, ...next].sort((a, b) => b.createdAt.localeCompare(a.createdAt))))) notifyHistoryChanged();
  return entry;
}

export function upsertCalculationByParams(record: Omit<CalculationRecord, "id" | "createdAt">): CalculationRecord {
  const entry: CalculationRecord = { ...record, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString() };
  if (!isValidCalculationRecord(entry)) return entry;
  const matches = (candidate: Record<string, string>) => Object.keys(record.params).length === Object.keys(candidate).length && Object.entries(record.params).every(([key, value]) => candidate[key] === value);
  const existing = getCalculationHistory();
  const sameKind = existing.filter(item => item.kind === entry.kind && !matches(item.params));
  const otherKinds = existing.filter(item => item.kind !== entry.kind);
  const next = [...sameKind, entry].slice(-HISTORY_LIMIT);
  if (writeStorage(STORAGE_KEY, JSON.stringify([...otherKinds, ...next].sort((a, b) => b.createdAt.localeCompare(a.createdAt))))) notifyHistoryChanged();
  return entry;
}

export function deleteCalculation(id: string) {
  if (writeStorage(STORAGE_KEY, JSON.stringify(getCalculationHistory().filter(item => item.id !== id)))) notifyHistoryChanged();
}
export function removeCalculationByParams(kind: CalculationKind, params: Record<string, string>) {
  const matches = (candidate: Record<string, string>) => Object.keys(params).length === Object.keys(candidate).length && Object.entries(params).every(([key, value]) => candidate[key] === value);
  if (writeStorage(STORAGE_KEY, JSON.stringify(getCalculationHistory().filter(item => item.kind !== kind || !matches(item.params))))) notifyHistoryChanged();
}
export function removeCalculationByKind(kind: CalculationKind) {
  if (writeStorage(STORAGE_KEY, JSON.stringify(getCalculationHistory().filter(item => item.kind !== kind)))) notifyHistoryChanged();
}
export function clearCalculationKinds(kinds: CalculationKind[]) {
  const selected = new Set(kinds);
  if (writeStorage(STORAGE_KEY, JSON.stringify(getCalculationHistory().filter(item => !selected.has(item.kind))))) notifyHistoryChanged();
}
export function clearCalculationHistory() {
  if (removeStorage(STORAGE_KEY)) notifyHistoryChanged();
}
export function getHistoryMode(): HistoryMode {
  if (typeof window === "undefined") return "manual";
  return readStorage(MODE_KEY) === "auto" ? "auto" : "manual";
}
export function setHistoryMode(mode: HistoryMode) {
  if (writeStorage(MODE_KEY, mode)) window.dispatchEvent(new CustomEvent("sd-history-settings-updated"));
}
