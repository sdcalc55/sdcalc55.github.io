import type React from "react"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"
import { ErrorReporter, ConsoleReporter, ReactErrorBoundary } from "@/components/error-reporter"
import PwaRegister from "@/components/pwa-register"

const inter = localFont({ src: "../public/fonts/InterVariable.woff2", display: "swap", weight: "100 900" });

const publicAsset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;

export const metadata: Metadata = {
  metadataBase: new URL("https://sdcalc55.github.io/"),
  title: "SD | Калькулятор",
  description: "Расчёт агентского вознаграждения и кредитный калькулятор",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "https://sdcalc55.github.io/",
    title: "SD | Калькулятор",
    description: "Расчёт агентского вознаграждения и кредитный калькулятор",
    images: [{
      url: "https://sdcalc55.github.io/images/sd-calculator-logo.png?v=160-white",
      width: 160,
      height: 160,
      alt: "SD - калькулятор расчётов",
    }],
  },
  twitter: {
    card: "summary",
    title: "SD | Калькулятор",
    description: "Расчёт агентского вознаграждения и кредитный калькулятор",
    images: ["https://sdcalc55.github.io/images/sd-calculator-logo.png?v=160"],
  },
  icons: {
    icon: publicAsset("/favicon.png?v=sd-calculator-1"),
    apple: [{ url: publicAsset("/icons/apple-touch-icon-180.png"), sizes: "180x180", type: "image/png" }],
  },
  manifest: publicAsset("/manifest.webmanifest"),
  appleWebApp: { capable: true, title: "SD | Калькулятор", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#E83C35",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var standalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;var touch=Number(navigator.maxTouchPoints||0)>0||window.matchMedia("(pointer: coarse)").matches;if(standalone)document.documentElement.classList.add("sd-installed-app");if(standalone||touch){if(touch)document.documentElement.classList.add("sd-touch-device");var viewport=document.querySelector("meta[name=viewport]");if(viewport)viewport.setAttribute("content","width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, interactive-widget=resizes-content");}})();` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){var m=null;var match=document.cookie.match(/(?:^|;\s*)sd-theme-mode-v1=(light|dark|system)(?:;|$)/);if(match)m=match[1];if(!m){try{m=localStorage.getItem("sd-theme-mode-v1");}catch(e){}}var d=m==="dark"||(m!=="light"&&m!=="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches)||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);})();` }} />
      </head>
      <body className={`${inter.className} antialiased [touch-action:pan-x_pan-y]`}>
        <ReactErrorBoundary>
          {children}
        </ReactErrorBoundary>
        <PwaRegister />
        <Toaster />
        <ErrorReporter />
        <ConsoleReporter />
      </body>
    </html>
  );
}
