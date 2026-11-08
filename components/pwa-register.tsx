"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PwaRegister() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
        console.error("PWA service worker registration failed:", error);
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  useEffect(() => {
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // На Android предлагаем системную установку, на iPhone показываем
    // инструкцию добавления сайта на экран «Домой».
    try {
      if ((isAndroid || isIOS) && sessionStorage.getItem("sd-install-banner-dismissed") !== "1") {
        setShowInstallBanner(true);
      }
    } catch {
      setShowInstallBanner(true);
    }

    const handleInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      try {
        if (sessionStorage.getItem("sd-install-banner-dismissed") !== "1") setShowInstallBanner(true);
      } catch {
        setShowInstallBanner(true);
      }
    };
    const handleInstalled = () => {
      setShowInstallBanner(false);
      setInstallPrompt(null);
    };

    if (!isIOS) window.addEventListener("beforeinstallprompt", handleInstallAvailable);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallAvailable);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    try { sessionStorage.setItem("sd-install-banner-dismissed", "1"); } catch {}
  };

  const installApp = async () => {
    if (installing) return;
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIOS) {
      setShowIosInstructions(true);
      return;
    }
    if (!installPrompt) {
      window.alert("Установка через системное окно пока недоступна. Откройте меню браузера ⋮ и выберите «Установить приложение» или «Добавить на главный экран».");
      return;
    }
    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted" || choice.outcome === "dismissed") {
        setShowInstallBanner(false);
      }
      setInstallPrompt(null);
    } catch (error) {
      console.error("PWA installation prompt failed:", error);
    } finally {
      setInstalling(false);
    }
  };

  useEffect(() => {
    const isEditable = (target: EventTarget | null): target is HTMLElement => {
      if (!(target instanceof HTMLElement)) return false;
      if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
      return target instanceof HTMLInputElement && !["button", "checkbox", "radio", "submit", "reset", "file"].includes(target.type);
    };

    let frame = 0;
    const revealFocusedField = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const field = document.activeElement;
        if (!isEditable(field)) return;
        const viewport = window.visualViewport;
        const visibleTop = viewport?.offsetTop ?? 0;
        const visibleBottom = visibleTop + (viewport?.height ?? window.innerHeight);
        const rect = field.getBoundingClientRect();
        const margin = 20;
        if (rect.bottom > visibleBottom - margin || rect.top < visibleTop + margin) {
          field.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
        }
      });
    };

    // Reveal the field only when it receives focus. Do not react to viewport
    // resize or clicks: dismissing the keyboard after scrolling must not pull
    // the page back to the previously focused input.
    document.addEventListener("focusin", revealFocusedField);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", revealFocusedField);
    };
  }, []);

  return (
    <>
    {showInstallBanner ? (
    <div className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-[100] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-[#E7D5D4] bg-white p-3 shadow-[0_8px_30px_rgba(22,34,51,0.18)] dark:border-[#46576A] dark:bg-[#1B2633]">
      <img src="/icons/sd-512.png?v=sd-icon-20261109" alt="" className="size-12 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#26364A] dark:text-[#E6ECF3]">SD | Калькулятор</p>
        <p className="text-xs text-[#748195] dark:text-[#AAB6C5]">Установить приложение</p>
      </div>
      <button type="button" onClick={installApp} disabled={installing} className="shrink-0 rounded-full bg-[#1769E8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#125AC8] disabled:opacity-60">
        {installing ? "Открываем..." : "Установить"}
      </button>
      <button type="button" onClick={dismissInstallBanner} aria-label="Закрыть предложение установки" className="shrink-0 rounded-full p-1.5 text-[#748195] hover:bg-[#F1F3F6] dark:hover:bg-[#2B3949]">
        <X className="size-4" />
      </button>
    </div>
    ) : null}
    {showIosInstructions ? (
      <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/45 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="ios-install-title">
        <div className="w-full max-w-md rounded-3xl bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl dark:bg-[#1B2633]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="ios-install-title" className="text-lg font-semibold text-[#26364A] dark:text-[#E6ECF3]">Установка на iPhone</h2>
            <button type="button" onClick={() => setShowIosInstructions(false)} aria-label="Закрыть инструкцию" className="rounded-full p-2 text-[#748195] hover:bg-[#F1F3F6] dark:hover:bg-[#2B3949]"><X className="size-5" /></button>
          </div>
          <ol className="space-y-3 text-sm leading-relaxed text-[#26364A] dark:text-[#E6ECF3]">
            <li><span className="mr-2 font-semibold text-[#E83C35]">1.</span>Нажмите «Поделиться» - значок квадрата со стрелкой вверх в браузере.</li>
            <li><span className="mr-2 font-semibold text-[#E83C35]">2.</span>В меню выберите «На экран Домой». Если пункта нет, откройте «Ещё».</li>
            <li><span className="mr-2 font-semibold text-[#E83C35]">3.</span>Нажмите «Добавить» в правом верхнем углу.</li>
          </ol>
          <button type="button" onClick={() => setShowIosInstructions(false)} className="mt-5 w-full rounded-full bg-[#E83C35] px-5 py-3 text-sm font-semibold text-white">Понятно</button>
        </div>
      </div>
    ) : null}
    </>
  );
}
