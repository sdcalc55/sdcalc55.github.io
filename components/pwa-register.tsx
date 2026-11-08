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
      <img src="data:image/webp;base64,UklGRq4FAABXRUJQVlA4IKIFAABwHQCdASpgAGAAPp1Gnkulo6KhpHmbGLATiWwAzjBa1BfKcof1BCycMPzf4D/c+yPbMeaH9rvWQ9MnoAf0TqV/QA8uf2af3R9KrNYdPH9mpGvuLFotZ7sVxPhe0rky/yE/VqSKsb8vilWUwfdlp8edCjDcXpglLFwidYJNORefRFQmNlgodl8Z/k6ORSf6XgveZtGJVMPHAt/DkIjHRZ8tPGz/vcFPg/mZhxo7rJp9YU58AzQTRlN7QmCIkObAFMjNgzTM73/yBbDccDvv31eHKBBn+/6kJ4suQ9bLJYgRjxt6/jD5GPxccTVVrBll7nQYxTwAAP77aDUKtMmiB05R984zF/giTgl1z38kQ1seey7YI/qpVq9vZKmIWdzA8fwnF8D3ntm8LXpU/hV5ILVyc04wg/FsBgPaw7r8xRoQaw7+y6TxHIFhuD29c7A6+UJYYMdOH7U+hQUF0ETxbYWy8umjsMGBeGkzjc7WwkILdAmcp/Vaw1TpgYhB7kATLFtMf4QZ8vp3wqTaobnrePu8Q6HqsAyuLYaqibnzMtIsH17qGaNLt8V5YNi/9ktm59S5Ea+thw4mJn6vAKiY9Lo93Tdrusdlm2bm6CbAlx/YMGe3LfelHRex/dDP4DonrqGUoM3lmLdJ5nIRnYKvg6NLmp2uaK+S0/9nYvFEy9nJxxADJUz5IxJY8FZrI2OS7otTqlrB87jhTeSZ8Du/FOWsrtD6aZdSZsK5b7ZXlYDApDa5CYSBfJSvRdxbcPmSWvjacewsJESn1yCLoB9My3owtfejEqor7kon8TIe5fPbQ0LJnVP7ij5PZUFEOYeWmy78N/GUkpq+Pp/9Sg9LngdD3bS17tOgw4kb1tDGvOPCJABsYIt2K6rGKxyqSn8skaS4dG/bjz8vw8qs6gdxOCLPrIF9yK5bJt2OJPJEV6Cx5pAy6wp22nawd8CWx/ziuw5OfGOS5DtdEdnIQKRO7aQWSZ3ANf4fstu1oaQsnp0tFIauE7HKtEzaFl4tMcW6MK/k6TNiwvt6D3610ppksBnbwpBl7TimJ079vXpVe4ab46dMafP3duoxcxfiTRWL9JEA8WUO6+pg5qba55oqO4C8NFUCx4f5PaDYYJWat1+6koZd9PMQl/K6EmSSYAb4n3xBrl1MtUpwRopvuPp677t3FNQV8Qd2/2pKzIAgvWxODBn3Ji8vMExdTo4wOHRdANhMARMOM5SPkgOhhJhZnuNhBJh9JU1jxfnc6T/lZPCZQjjc99wWA0FEGKxKgjkhVI7F9bADJWlDW1ITEt7aHF9VWRhn+k5TJA306fqj8LOWwev9QhRm/1ylTR0Xs91BZxVWTBR00p0yOQ/PNuB3sDCAU78q6a3PtKDaUlMkK1GKWlsebM9nIPEps5JbXiDr4FFYfKTfmue/3Lobro0cf30CAkmWojh2qqu0Gc4sXw/b8rj5Pb33SNWc7tmmWyHaMU35+ut07sILi6l1nzVHT3hNt+Is0tY6ZOqMxlnHxN03VCSfl/7M9gYt6luK+wIXP8A7eoRC/T7YmdpcoTIWJ6i038APsQiLqDIrF6LJO2OsPm9u2Nk4Vbqbhyn407sE9y8LzfWOBYddkn7c0uKuMIH23qIeEFXWP86jYaTB2krPGrKQstMBEcB0WM/JLa6fHibrpE8XxPCEpqQyYr3G6uoPi6KTSPItqjgm+jIdy2EXF/96yeAVVCqBPeUAZrUXPn9kkWW3BvSG6EKeO1c54SiCGQKotXFReL3iPlbf54/0sWJPAjrBIPSs/VVzUX8VKJGpbBSJg4nSMEpejXQCf9BKH5T4lUQhK3uSSK08X9qrvUkxFH6Q2dEiwee3eEQu0zxogN0/IwcZGQd7kKc7x+4aUpO76KCbUD+DolRKDf89RZBDXSp4gLc7tdxAeqvfNAaAAA==" alt="" className="size-12 shrink-0 rounded-xl object-cover" />
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
