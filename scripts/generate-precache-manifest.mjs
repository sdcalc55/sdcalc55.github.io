import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve("out");
const manifestPath = path.join(outputDirectory, "precache-manifest.json");
const files = [];

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(absolutePath);
      continue;
    }
    if (!entry.isFile()) continue;
    const relativePath = path.relative(outputDirectory, absolutePath).split(path.sep).join("/");
    if (relativePath === "sw.js" || relativePath === "precache-manifest.json") continue;
    files.push("/" + relativePath);
  }
}

await collect(outputDirectory);
files.sort();
if (!files.includes("/index.html")) throw new Error("Static export is missing out/index.html");
const html = await readFile(path.join(outputDirectory, "index.html"), "utf8");
const critical = new Set();
for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
  critical.add(new URL(match[1], "https://sdcalc55.github.io").pathname);
}
for (const match of html.matchAll(/<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
  critical.add(new URL(match[1], "https://sdcalc55.github.io").pathname);
}
// The header logo is visible immediately on launch and must be available
// when the installed PWA is opened without a network connection.
critical.add("/images/sd-calculator-logo-transparent.webp");
critical.add("/images/svdemidenko-portrait.webp");
const criticalFiles = [...critical].filter(file =>
  file.startsWith("/_next/") ||
  file === "/images/sd-calculator-logo-transparent.webp" ||
  file === "/images/svdemidenko-portrait.webp"
).sort();
if (criticalFiles.length === 0) throw new Error("Could not identify critical JS/CSS assets in index.html");
await writeFile(manifestPath, JSON.stringify({ version: 2, files, critical: criticalFiles }, null, 2) + "\n");
const hash = createHash("sha256");
for (const file of files) {
  hash.update(file);
  hash.update(await readFile(path.join(outputDirectory, file.slice(1))));
}
const buildVersion = hash.digest("hex").slice(0, 16);
const serviceWorkerPath = path.join(outputDirectory, "sw.js");
const serviceWorker = await readFile(serviceWorkerPath, "utf8");
if (!serviceWorker.includes("__BUILD_VERSION__")) throw new Error("Service worker build version placeholder is missing");
await writeFile(serviceWorkerPath, serviceWorker.replaceAll("__BUILD_VERSION__", buildVersion));
console.log(`Generated manifest with ${files.length} exported files and ${criticalFiles.length} critical assets; service worker version ${buildVersion}.`);
