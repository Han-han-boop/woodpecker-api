import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { fail, ok } from "../lib/response";

const syncPushSchema = z.object({
  attempts: z.any().optional(),
  realTrades: z.any().optional(),
  settings: z.any().optional()
});

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  // POST /sync/push — save full frontend state for the authenticated user
  app.post("/sync/push", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsed = syncPushSchema.safeParse(request.body);
    if (!parsed.success) {
      const response = fail("BAD_REQUEST", "Invalid request body", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const { attempts, realTrades, settings } = parsed.data;

    const userData = await prisma.userData.upsert({
      where: { userId: request.user.id },
      update: {
        ...(attempts !== undefined ? { attempts } : {}),
        ...(realTrades !== undefined ? { realTrades } : {}),
        ...(settings !== undefined ? { settings } : {})
      },
      create: {
        userId: request.user.id,
        attempts: attempts ?? [],
        realTrades: realTrades ?? [],
        settings: settings ?? {}
      }
    });

    return reply.send(ok({ updatedAt: userData.updatedAt }));
  });

  // GET /sync/pull — retrieve full frontend state for the authenticated user
  app.get("/sync/pull", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    const userData = await prisma.userData.findUnique({
      where: { userId: request.user.id }
    });

    if (!userData) {
      return reply.send(ok({
        attempts: [],
        realTrades: [],
        settings: {},
        updatedAt: null
      }));
    }

    return reply.send(ok({
      attempts: userData.attempts,
      realTrades: userData.realTrades,
      settings: userData.settings,
      updatedAt: userData.updatedAt
    }));
  });
}
