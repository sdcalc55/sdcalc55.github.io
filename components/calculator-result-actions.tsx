"use client";

import { Bookmark, BookmarkCheck, Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

type CalculatorResultActionsProps = {
  onCopy: () => Promise<boolean>;
  onSave: () => void;
  copyKey: string;
  isSaved: boolean;
  disabled?: boolean;
};

const actionClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#D8DEE7] bg-transparent px-3 text-xs font-medium text-[#657184] transition hover:bg-[#F3F5F7] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#46576A] dark:bg-transparent dark:text-[#AEBBCB] dark:hover:bg-[#263442]";

export function CalculatorResultActions({ onCopy, onSave, isSaved, copyKey, disabled = false }: CalculatorResultActionsProps) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { setCopied(false); }, [copyKey]);
  const handleCopy = async () => {
    if (await onCopy()) {
      setCopied(true);
    }
  };
  return (
    <div className="mt-4 grid grid-cols-2 gap-2" data-testid="calculator-result-actions">
      <button type="button" data-testid="calculator-copy" onClick={handleCopy} disabled={disabled} className={actionClass}>
        {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}{copied ? "Скопировано" : "Копировать"}
      </button>
      <button type="button" data-testid="calculator-save" onClick={onSave} disabled={disabled} aria-pressed={isSaved} className={`${actionClass} ${isSaved ? "border-[#D98A85] bg-transparent text-[#B94742] dark:border-[#A96560] dark:bg-transparent dark:text-[#FF9A93]" : ""}`}>
        {isSaved ? <BookmarkCheck aria-hidden="true" className="size-4" /> : <Bookmark aria-hidden="true" className="size-4" />}
        {isSaved ? "Убрать сохранение" : "Сохранить"}
      </button>
    </div>
  );
}
