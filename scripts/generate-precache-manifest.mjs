import { readdir, writeFile } from "node:fs/promises";
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
await writeFile(manifestPath, JSON.stringify({ version: 1, files }, null, 2) + "\n");
console.log(`Generated offline precache manifest with ${files.length} files.`);
