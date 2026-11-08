"use client";

import { Bookmark, Copy } from "lucide-react";

type CalculatorResultActionsProps = {
  onCopy: () => void;
  onSave: () => void;
  isSaved: boolean;
  disabled?: boolean;
};

const actionClass = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[#D8DEE7] bg-transparent px-2.5 text-[13px] font-semibold text-[#465467] transition hover:bg-[#F3F5F7] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#607084] dark:bg-[#1B2734] dark:text-[#DCE5EF] dark:hover:bg-[#2B3A4B]";

export function CalculatorResultActions({ onCopy, onSave, isSaved, disabled = false }: CalculatorResultActionsProps) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2" data-testid="calculator-result-actions">
      <button type="button" data-testid="calculator-copy" onClick={onCopy} disabled={disabled} className={actionClass}>
        <Copy aria-hidden="true" className="size-4" />Копировать
      </button>
      <button type="button" data-testid="calculator-save" onClick={onSave} disabled={disabled} aria-pressed={isSaved} className={`${actionClass} ${isSaved ? "border-[#E6B8B5] bg-[#FFF7F6] text-[#B94742] dark:border-[#80514E] dark:bg-[#352322] dark:text-[#FF9A93]" : ""}`}>
        <Bookmark aria-hidden="true" className="size-4" fill={isSaved ? "currentColor" : "none"} />
        {isSaved ? "Сохранено" : "Сохранить"}
      </button>
    </div>
  );
}
