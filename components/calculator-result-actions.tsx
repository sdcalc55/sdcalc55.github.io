"use client";

import { Bookmark, BookmarkCheck, Check, Copy } from "lucide-react";
import { useEffect, useId, useState } from "react";

type CalculatorResultActionsProps = {
  onCopy: () => Promise<boolean>;
  onSave: () => void;
  copyKey: string;
  isSaved: boolean;
  disabled?: boolean;
};

const COPY_EVENT = "sd-calculator-copy";
const actionClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#D8DEE7] bg-transparent px-3 text-xs font-medium text-[#657184] transition hover:bg-[#F3F5F7] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#46576A] dark:bg-transparent dark:text-[#AEBBCB] dark:hover:bg-[#263442]";

export function CalculatorResultActions({ onCopy, onSave, isSaved, copyKey, disabled = false }: CalculatorResultActionsProps) {
  const [copied, setCopied] = useState(false);
  const instanceId = useId();

  useEffect(() => {
    setCopied(false);
  }, [copyKey]);

  useEffect(() => {
    const handleOtherCopy = (event: Event) => {
      const source = (event as CustomEvent<{ source?: string }>).detail?.source;
      if (source !== instanceId) setCopied(false);
    };
    const resetOnLeave = () => {
      if (document.visibilityState !== "visible") setCopied(false);
    };
    const resetOnReturn = () => setCopied(false);
    window.addEventListener(COPY_EVENT, handleOtherCopy);
    document.addEventListener("visibilitychange", resetOnLeave);
    window.addEventListener("focus", resetOnReturn);
    return () => {
      window.removeEventListener(COPY_EVENT, handleOtherCopy);
      document.removeEventListener("visibilitychange", resetOnLeave);
      window.removeEventListener("focus", resetOnReturn);
    };
  }, [instanceId]);

  const handleCopy = async () => {
    if (await onCopy()) {
      setCopied(true);
      window.dispatchEvent(new CustomEvent(COPY_EVENT, { detail: { source: instanceId } }));
    }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center justify-start gap-2" data-testid="calculator-result-actions">
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
