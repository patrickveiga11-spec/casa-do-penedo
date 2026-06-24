import { loadEnv } from "./lib/load-env.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  blockRoutes,
  calendarRoutes,
  dashboardRoutes,
  pricingRoutes,
  propertyRoutes,
  reservationRoutes,
} from "./routes/index.js";
import { authRoutes } from "./routes/auth.js";
import { cronRoutes } from "./routes/cron.js";

loadEnv();

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => ({ status: "ok", module: "reservas" }));

await app.register(authRoutes);
await app.register(propertyRoutes);
await app.register(reservationRoutes);
await app.register(calendarRoutes);
await app.register(pricingRoutes);
await app.register(blockRoutes);
await app.register(dashboardRoutes);
await app.register(cronRoutes);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
