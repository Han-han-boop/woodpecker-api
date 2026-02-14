import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const codes = Array.from({ length: 5 }, (_, index) => `WOODPECKER-${index + 1}`);

  for (const code of codes) {
    await prisma.inviteCode.upsert({
      where: { code },
      update: {
        status: "active"
      },
      create: {
        code,
        status: "active",
        maxUses: 100
      }
    });
  }

  console.log(`Seeded ${codes.length} invite codes.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
