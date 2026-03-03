import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Revoke old WOODPECKER-* codes
  const oldCodes = Array.from({ length: 5 }, (_, i) => `WOODPECKER-${i + 1}`);
  for (const code of oldCodes) {
    await prisma.inviteCode.updateMany({
      where: { code },
      data: { status: "revoked" }
    });
  }

  // Single invite code
  await prisma.inviteCode.upsert({
    where: { code: "Alexispayetontacos" },
    update: {
      status: "active"
    },
    create: {
      code: "Alexispayetontacos",
      status: "active",
      maxUses: null
    }
  });

  console.log("Seeded invite code: Alexispayetontacos (old codes revoked).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
