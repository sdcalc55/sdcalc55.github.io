"use client";

import { Bookmark, BookmarkCheck, Check, Copy } from "lucide-react";
import { useEffect, useId, useState } from "react";

type CalculatorResultActionsProps = {
  onCopy: () => Promise<boolean>;
  onSave: () => void;
  copyKey: string;
  isSaved: boolean;
  disabled?: boolean;
  appearance?: "default" | "commission";
};

const COPY_EVENT = "sd-calculator-copy";
const actionClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border bg-transparent px-3 text-xs font-medium text-[#657184] transition hover:bg-[#F3F5F7] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-transparent dark:text-[#AEBBCB] dark:hover:bg-[#263442]";

export function CalculatorResultActions({ onCopy, onSave, isSaved, copyKey, disabled = false, appearance = "default" }: CalculatorResultActionsProps) {
  const [copied, setCopied] = useState(false);
  const instanceId = useId();
  const actionStyle = appearance === "commission"
    ? "border-[#B9C4D1] dark:border-[#60748A]"
    : "border-[#D8DEE7] dark:border-[#46576A]";
  const savedStyle = appearance === "commission"
    ? "border-[#C66F69] dark:border-[#C17A74]"
    : "border-[#D98A85] dark:border-[#A96560]";

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
    <div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2" data-testid="calculator-result-actions">
      <button type="button" data-testid="calculator-copy" onClick={handleCopy} disabled={disabled} className={`${actionClass} ${actionStyle} w-full min-w-0 gap-1 px-2 text-xs leading-none whitespace-nowrap max-[360px]:text-[11px] sm:min-h-11 sm:gap-2 sm:px-4 sm:text-sm`}>
        {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4 sm:size-5" />}{copied ? "Скопировано" : "Копировать"}
      </button>
      <button type="button" data-testid="calculator-save" onClick={onSave} disabled={disabled} aria-pressed={isSaved} className={`${actionClass} ${actionStyle} w-full min-w-0 gap-1 px-2 text-xs leading-none whitespace-nowrap max-[360px]:text-[11px] sm:min-h-11 sm:gap-2 sm:px-4 sm:text-sm ${isSaved ? `${savedStyle} bg-transparent text-[#B94742] dark:bg-transparent dark:text-[#FF9A93]` : ""}`}>
        {!isSaved && <Bookmark aria-hidden="true" className="hidden size-4 shrink-0 min-[375px]:inline-block sm:size-5" />}
        <span className="min-w-0">{isSaved ? "Убрать сохранение" : "Сохранить"}</span>
      </button>
    </div>
  );
}
