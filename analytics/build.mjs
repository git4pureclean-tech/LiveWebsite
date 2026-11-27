import { mkdir, readFile, writeFile } from "node:fs/promises";

const base = new URL("../", import.meta.url);
const controls = await readFile(new URL("analytics/controls.json", base), "utf8");
const source = await readFile(new URL("analytics/worker.js", base), "utf8");
await mkdir(new URL("dist/server/", base), { recursive: true });
await writeFile(new URL("dist/server/index.js", base), `const controls = ${controls.trim()};\n\n${source}`);
