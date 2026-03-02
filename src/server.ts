import { buildServer } from "./app";
import { env } from "./env";
import { prisma } from "./lib/prisma";

async function main() {
  await prisma.$connect();

  const app = buildServer();
  app.log.info({ AUTH_DISABLED: env.AUTH_DISABLED, cwd: process.cwd() }, "Server startup env");

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  await app.listen({
    port: env.PORT,
    host: "0.0.0.0"
  });
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
