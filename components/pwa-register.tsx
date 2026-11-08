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
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!isAndroid || isStandalone) return;

    const handleInstallAvailable = (event: Event) => {
      event.preventDefault();
      const installEvent = event as InstallPromptEvent;
      setInstallPrompt(installEvent);
      try {
        if (sessionStorage.getItem("sd-install-banner-dismissed") !== "1") {
          setShowInstallBanner(true);
        }
      } catch {
        setShowInstallBanner(true);
      }
    };
    const handleInstalled = () => {
      setShowInstallBanner(false);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleInstallAvailable);
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
    if (!installPrompt || installing) return;
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

  return showInstallBanner && installPrompt ? (
    <div className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-[100] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-[#E7D5D4] bg-white p-3 shadow-[0_8px_30px_rgba(22,34,51,0.18)] dark:border-[#46576A] dark:bg-[#1B2633]">
      <img src="data:image/jpeg;base64,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" alt="" className="size-12 shrink-0 rounded-xl object-cover" />
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
  ) : null;
}
