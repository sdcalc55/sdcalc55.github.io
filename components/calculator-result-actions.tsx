"use client";

import { Bookmark, Copy } from "lucide-react";

type CalculatorResultActionsProps = {
  onCopy: () => void;
  onSave: () => void;
  isSaved: boolean;
  disabled?: boolean;
};

const actionClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-transparent bg-[#EEF1F5] px-3 text-xs font-medium text-[#657184] transition hover:bg-[#E4E9EF] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#263442] dark:text-[#AEBBCB] dark:hover:bg-[#304153]";

export function CalculatorResultActions({ onCopy, onSave, isSaved, disabled = false }: CalculatorResultActionsProps) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2" data-testid="calculator-result-actions">
      <button type="button" data-testid="calculator-copy" onClick={onCopy} disabled={disabled} className={actionClass}>
        <Copy aria-hidden="true" className="size-4" />Копировать
      </button>
      <button type="button" data-testid="calculator-save" onClick={onSave} disabled={disabled} aria-pressed={isSaved} className={`${actionClass} ${isSaved ? "border-transparent bg-[#FCEBEA] text-[#B94742] dark:bg-[#352B2B] dark:text-[#FF9A93]" : ""}`}>
        <Bookmark aria-hidden="true" className="size-4" fill={isSaved ? "currentColor" : "none"} />
        {isSaved ? "Сохранено" : "Сохранить"}
      </button>
    </div>
  );
}
