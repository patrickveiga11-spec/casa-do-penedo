import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = join(root, "../api/assets");
const publicDir = join(root, "public");

const files = [
  { name: "guia-boas-vindas.pdf" },
  { name: "regulamento-interno.pdf" },
];

mkdirSync(publicDir, { recursive: true });

for (const { name } of files) {
  const source = join(assetsDir, name);
  const target = join(publicDir, name);

  if (!existsSync(source)) {
    console.warn("[copy-public-pdfs] PDF não encontrado:", source);
    continue;
  }

  copyFileSync(source, target);
  console.log("[copy-public-pdfs] Copiado para public/" + name);
}
