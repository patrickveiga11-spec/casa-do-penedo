import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.upsert({
    where: { slug: "casa-do-penedo" },
    update: { basePrice: 100, maxGuests: 10 },
    create: {
      name: "Casa do Penedo",
      slug: "casa-do-penedo",
      address: "Fafe, Braga, Portugal",
      basePrice: 100,
      currency: "EUR",
      maxGuests: 10,
    },
  });

  await prisma.pricingRule.deleteMany({ where: { propertyId: property.id } });

  await prisma.pricingRule.create({
    data: {
      propertyId: property.id,
      name: "Estadia longa (6+ noites, -10%)",
      priority: 1,
      minNights: 6,
      modifier: -10,
      modifierType: "PERCENT",
    },
  });

  const existingReservation = await prisma.reservation.findFirst({
    where: { propertyId: property.id, guestName: "Ana Rodrigues" },
  });

  if (!existingReservation) {
    await prisma.reservation.create({
      data: {
        propertyId: property.id,
        guestName: "Ana Rodrigues",
        guestEmail: "ana@example.com",
        checkIn: new Date("2026-06-05"),
        checkOut: new Date("2026-06-08"),
        guests: 2,
        totalPrice: 300,
        status: "CONFIRMED",
      },
    });
  }

  console.log("Seed concluído:", property.name);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
