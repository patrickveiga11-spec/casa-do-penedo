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
import { guestRoutes } from "./routes/guests.js";
import { authRoutes } from "./routes/auth.js";
import { cronRoutes } from "./routes/cron.js";
import { startWelcomeEmailCron } from "./lib/welcome-cron.js";
import { backfillMissingAccessCodes } from "./services/access-code.js";
import { backfillGuestRegistry } from "./services/guest-registry.js";

loadEnv();

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => ({
  status: "ok",
  module: "reservas",
  email: {
    brevoConfigured: Boolean(process.env.BREVO_API_KEY?.trim()),
    ownerConfigured: Boolean(
      process.env.OWNER_NOTIFICATION_EMAILS?.trim() || process.env.OWNER_EMAIL?.trim()
    ),
  },
}));

await app.register(authRoutes);
await app.register(propertyRoutes);
await app.register(reservationRoutes);
await app.register(calendarRoutes);
await app.register(pricingRoutes);
await app.register(blockRoutes);
await app.register(dashboardRoutes);
await app.register(guestRoutes);
await app.register(cronRoutes);

try {
  await app.listen({ port, host: "0.0.0.0" });
  startWelcomeEmailCron();
  void backfillMissingAccessCodes().then((result) => {
    if (result.updated > 0) {
      app.log.info(result, "Códigos de acesso atribuídos a reservas validadas");
    }
  });
  void backfillGuestRegistry().then((result) => {
    if (result.synced > 0) {
      app.log.info(result, "Base de hóspedes sincronizada");
    }
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
