import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { fail, ok } from "../lib/response";

const createTradeBodySchema = z.object({
  runId: z.string().trim().min(1),
  direction: z.enum(["long", "short"]),
  entryTsUtc: z.string().datetime(),
  entryPrice: z.number().finite().positive(),
  slPrice: z.number().finite().positive().optional(),
  tpPrice: z.number().finite().positive().optional(),
  notes: z.string().trim().optional()
});

const tradeParamsSchema = z.object({
  tradeId: z.string().trim().min(1)
});

const runParamsSchema = z.object({
  runId: z.string().trim().min(1)
});

const patchTradeBodySchema = z.object({
  direction: z.enum(["long", "short"]).optional(),
  entryTsUtc: z.string().datetime().optional(),
  entryPrice: z.number().finite().positive().optional(),
  slPrice: z.number().finite().positive().nullable().optional(),
  tpPrice: z.number().finite().positive().nullable().optional(),
  notes: z.string().trim().nullable().optional()
});

const db = prisma as any;

export async function tradeRoutes(app: FastifyInstance): Promise<void> {
  // POST /trades
  app.post("/trades", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedBody = createTradeBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      const response = fail("BAD_REQUEST", "Invalid request body", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const run = await db.sessionRun.findFirst({
      where: {
        id: parsedBody.data.runId,
        template: {
          block: {
            ownerId: request.user.id
          }
        }
      },
      select: { id: true }
    });

    if (!run) {
      const response = fail("RUN_NOT_FOUND", "Run not found", 404);
      return reply.status(response.statusCode).send(response.body);
    }

    const trade = await db.trade.create({
      data: {
        runId: run.id,
        direction: parsedBody.data.direction,
        entryTsUtc: new Date(parsedBody.data.entryTsUtc),
        entryPrice: parsedBody.data.entryPrice,
        slPrice: parsedBody.data.slPrice ?? null,
        tpPrice: parsedBody.data.tpPrice ?? null,
        notes: parsedBody.data.notes ?? null
      }
    });

    return reply.status(201).send(ok({ trade }));
  });

  // GET /runs/:runId/trades
  app.get("/runs/:runId/trades", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedParams = runParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      const response = fail("BAD_REQUEST", "Invalid runId", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const run = await db.sessionRun.findFirst({
      where: {
        id: parsedParams.data.runId,
        template: {
          block: {
            ownerId: request.user.id
          }
        }
      },
      select: { id: true }
    });

    if (!run) {
      const response = fail("RUN_NOT_FOUND", "Run not found", 404);
      return reply.status(response.statusCode).send(response.body);
    }

    const trades = await db.trade.findMany({
      where: { runId: run.id },
      orderBy: { entryTsUtc: "asc" }
    });

    return reply.send(ok({ trades }));
  });

  // PATCH /trades/:tradeId
  app.patch("/trades/:tradeId", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedParams = tradeParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      const response = fail("BAD_REQUEST", "Invalid tradeId", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedBody = patchTradeBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      const response = fail("BAD_REQUEST", "Invalid request body", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const existing = await db.trade.findFirst({
      where: {
        id: parsedParams.data.tradeId,
        run: {
          template: {
            block: {
              ownerId: request.user.id
            }
          }
        }
      },
      select: { id: true }
    });

    if (!existing) {
      const response = fail("TRADE_NOT_FOUND", "Trade not found", 404);
      return reply.status(response.statusCode).send(response.body);
    }

    const updateData: Record<string, unknown> = {};
    if (parsedBody.data.direction !== undefined) updateData.direction = parsedBody.data.direction;
    if (parsedBody.data.entryTsUtc !== undefined) updateData.entryTsUtc = new Date(parsedBody.data.entryTsUtc);
    if (parsedBody.data.entryPrice !== undefined) updateData.entryPrice = parsedBody.data.entryPrice;
    if (parsedBody.data.slPrice !== undefined) updateData.slPrice = parsedBody.data.slPrice;
    if (parsedBody.data.tpPrice !== undefined) updateData.tpPrice = parsedBody.data.tpPrice;
    if (parsedBody.data.notes !== undefined) updateData.notes = parsedBody.data.notes;

    const trade = await db.trade.update({
      where: { id: existing.id },
      data: updateData
    });

    return reply.send(ok({ trade }));
  });
}
