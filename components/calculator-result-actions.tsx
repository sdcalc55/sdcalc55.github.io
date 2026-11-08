"use client";

import { Bookmark, Copy } from "lucide-react";

type CalculatorResultActionsProps = {
  onCopy: () => void;
  onSave: () => void;
  isSaved: boolean;
  disabled?: boolean;
};

const actionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#D8DEE7] bg-white/65 px-3 text-sm font-semibold transition hover:bg-white disabled:opacity-40 dark:border-[#65768A] dark:bg-[#182330] dark:hover:bg-[#314154]";

export function CalculatorResultActions({ onCopy, onSave, isSaved, disabled = false }: CalculatorResultActionsProps) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-2" data-testid="calculator-result-actions">
      <button type="button" data-testid="calculator-copy" onClick={onCopy} disabled={disabled} className={`${actionClass} text-[#465467] dark:text-[#F1F5F9]`}>
        <Copy aria-hidden="true" className="size-4" />Копировать
      </button>
      <button type="button" data-testid="calculator-save" onClick={onSave} disabled={disabled} aria-pressed={isSaved} className={`${actionClass} ${isSaved ? "text-[#E83C35]" : "text-[#465467] dark:text-[#F1F5F9]"}`}>
        <Bookmark aria-hidden="true" className="size-4" fill={isSaved ? "currentColor" : "none"} />
        {isSaved ? "Сохранено" : "Сохранить"}
      </button>
    </div>
  );
}
