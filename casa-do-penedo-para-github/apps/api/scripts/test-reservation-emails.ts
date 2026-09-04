import { loadEnv } from "../src/lib/load-env.js";
import {
  sendReservationCancellation,
  sendReservationFinalConfirmation,
  sendWelcomeGuideEmail,
} from "../src/services/email.js";

loadEnv();

const property = {
  id: "p",
  name: "Casa do Penedo",
  slug: "casa-do-penedo",
  address: "Fafe",
  basePrice: "100",
  currency: "EUR",
  maxGuests: 10,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const reservation = {
  id: "test",
  propertyId: "p",
  channelId: null,
  externalRef: null,
  guestName: "Teste Email",
  guestEmail: process.argv[2] ?? "casa_do_penedo@outlook.com",
  guestPhone: "912000000",
  checkIn: new Date("2026-12-10"),
  checkOut: new Date("2026-12-12"),
  guests: 2,
  totalPrice: "200",
  discountPercent: null,
  currency: "EUR",
  status: "CONFIRMED" as const,
  notes: null,
  validatedAt: new Date(),
  welcomeEmailSentAt: null,
  accessCode: "1234",
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function main() {
  const validation = await sendReservationFinalConfirmation({ reservation, property });
  console.log("Validação:", validation);

  const welcome = await sendWelcomeGuideEmail({ reservation, property });
  console.log("Boas-vindas (2 PDFs):", welcome);

  const cancellation = await sendReservationCancellation({ reservation, property });
  console.log("Anulação:", cancellation);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
