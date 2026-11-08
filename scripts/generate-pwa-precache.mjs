import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const outputDir = path.resolve("out");
const files = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(absolute);
      continue;
    }
    const relative = path.relative(outputDir, absolute).split(path.sep).join("/");
    if (relative === "sw.js" || relative === "precache-manifest.json" || relative.endsWith(".map") || relative.endsWith(".html")) continue;
    files.push("/" + relative);
  }
}

await stat(outputDir);
await walk(outputDir);
files.sort();
const manifest = ["/", "/manifest.webmanifest", ...files];
const uniqueManifest = [...new Set(manifest)];
await writeFile(path.join(outputDir, "precache-manifest.json"), JSON.stringify(uniqueManifest));

const digestHash = createHash("sha256");
digestHash.update(await readFile(path.join(outputDir, "index.html")));
for (const url of uniqueManifest) {
  digestHash.update(url);
  if (url !== "/") digestHash.update(await readFile(path.join(outputDir, url.slice(1))));
}
const digest = digestHash.digest("hex").slice(0, 12);
const swPath = path.join(outputDir, "sw.js");
const sw = await readFile(swPath, "utf8");
if (!sw.includes("sd-calculator-pwa-build")) {
  throw new Error("Expected PWA cache version marker was not found in out/sw.js");
}
await writeFile(swPath, sw.replace("sd-calculator-pwa-build", `sd-calculator-pwa-${digest}`));

console.log(`PWA precache generated: ${uniqueManifest.length} URLs, cache version ${digest}`);
