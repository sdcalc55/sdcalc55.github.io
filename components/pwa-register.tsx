"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";

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
      <img src="/icons/sd-192.png" alt="" className="size-12 shrink-0 rounded-xl object-cover" />
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
