import type React from "react"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"
import { ErrorReporter, ConsoleReporter, ReactErrorBoundary } from "@/components/error-reporter"
import PwaRegister from "@/components/pwa-register"

const inter = localFont({ src: "../public/fonts/InterVariable.woff2", display: "swap", weight: "100 900" });
const publicAsset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
const iconVersion = "sd-icon-20261108-v4";
const previewVersion = "sd-preview-20261108-v3";

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
    images: [{ url: `https://sdcalc55.github.io/og-preview.png?v=${previewVersion}`, secureUrl: `https://sdcalc55.github.io/og-preview.png?v=${previewVersion}`, width: 1200, height: 630, type: "image/png", alt: "SD Calculator - калькулятор расчётов" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SD | Калькулятор",
    description: "Расчёт агентского вознаграждения и кредитный калькулятор",
    images: [`https://sdcalc55.github.io/og-preview.png?v=${previewVersion}`],
  },
  icons: {
    icon: [
      { url: publicAsset(`/favicon.ico?v=${iconVersion}`), sizes: "any" },
      { url: publicAsset(`/icons/sd-32.png?v=${iconVersion}`), sizes: "32x32", type: "image/png" },
      { url: publicAsset(`/icons/sd-64.png?v=${iconVersion}`), sizes: "64x64", type: "image/png" },
      { url: publicAsset(`/icons/sd-192.png?v=${iconVersion}`), sizes: "192x192", type: "image/png" },
      { url: publicAsset(`/icons/sd-512.png?v=${iconVersion}`), sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: publicAsset(`/icons/apple-touch-icon-180.png?v=${iconVersion}`), sizes: "180x180", type: "image/png" }],
  },
  manifest: publicAsset(`/manifest.webmanifest?v=${iconVersion}`),
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <head>
        <link rel="icon" href={publicAsset(`/favicon.ico?v=${iconVersion}`)} sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href={publicAsset(`/icons/sd-32.png?v=${iconVersion}`)} />
        <link rel="icon" type="image/png" sizes="64x64" href={publicAsset(`/icons/sd-64.png?v=${iconVersion}`)} />
        <link rel="icon" type="image/png" sizes="192x192" href={publicAsset(`/icons/sd-192.png?v=${iconVersion}`)} />
        <link rel="apple-touch-icon" sizes="180x180" href={publicAsset(`/icons/apple-touch-icon-180.png?v=${iconVersion}`)} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){var standalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;var touch=Number(navigator.maxTouchPoints||0)>0||window.matchMedia("(pointer: coarse)").matches;if(standalone)document.documentElement.classList.add("sd-installed-app");if(standalone||touch){if(touch)document.documentElement.classList.add("sd-touch-device");var viewport=document.querySelector("meta[name=viewport]");if(viewport)viewport.setAttribute("content","width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, interactive-widget=resizes-content");}})();` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){var m=null;var match=document.cookie.match(/(?:^|;\\s*)sd-theme-mode-v2=(light|dark|system)(?:;|$)/);if(match)m=match[1];if(!m){try{m=localStorage.getItem("sd-theme-mode-v2");}catch(e){}}var d=m==="dark"||(m!=="light"&&m!=="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches)||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);})();` }} />
      </head>
      <body className={`${inter.className} antialiased [touch-action:pan-x_pan-y]`}>
        <ReactErrorBoundary>{children}</ReactErrorBoundary>
        <PwaRegister />
        <Toaster />
        <ErrorReporter />
        <ConsoleReporter />
      </body>
    </html>
  );
}
