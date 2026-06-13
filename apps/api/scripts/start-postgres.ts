import EmbeddedPostgres from "embedded-postgres";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const databaseDir = path.resolve(__dirname, "../../../.data/postgres");

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "casa",
  password: "casa",
  port: 5432,
  persistent: true,
});

await pg.initialise();
await pg.start();

try {
  await pg.createDatabase("casa_do_penedo");
} catch {
  // Database may already exist on subsequent runs.
}

console.log("PostgreSQL disponível em postgresql://casa:casa@localhost:5432/casa_do_penedo");

execSync("npx prisma migrate deploy", {
  cwd: path.resolve(__dirname, ".."),
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: "postgresql://casa:casa@localhost:5432/casa_do_penedo?schema=public",
  },
});

execSync("npx tsx prisma/seed.ts", {
  cwd: path.resolve(__dirname, ".."),
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: "postgresql://casa:casa@localhost:5432/casa_do_penedo?schema=public",
  },
});

process.on("SIGINT", async () => {
  await pg.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await pg.stop();
  process.exit(0);
});

console.log("Base de dados pronta. Mantém este processo a correr durante o desenvolvimento.");
