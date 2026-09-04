#!/usr/bin/env node
/**
 * Agente de envios Casa do Penedo
 * Corre em background no Mac e esvazia a fila de emails (gestão + iCloud)
 * sem intervenção manual.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const script = resolve(__dirname, "send-pending-owner-emails.mjs");
const intervalMs = Number(process.env.CASA_EMAIL_AGENT_INTERVAL_MS || 120_000);

if (!existsSync(script)) {
  console.error("Script em falta:", script);
  process.exit(1);
}

console.log(`[casa-email-agent] a iniciar — intervalo ${Math.round(intervalMs / 1000)}s`);
console.log(`[casa-email-agent] script ${script}`);

function runOnce() {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [script], {
      cwd: resolve(__dirname, ".."),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      out += chunk.toString();
    });
    child.on("close", (code) => {
      const stamp = new Date().toISOString();
      const summary = out.trim().split("\n").slice(-3).join(" | ");
      console.log(`[casa-email-agent] ${stamp} exit=${code} ${summary}`);
      resolvePromise(code);
    });
  });
}

async function loop() {
  for (;;) {
    try {
      await runOnce();
    } catch (error) {
      console.error("[casa-email-agent] erro", error);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

await runOnce();
await loop();
