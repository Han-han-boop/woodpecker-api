import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { fail, ok } from "../lib/response";

const createJournalBodySchema = z.object({
  runId: z.string().trim().min(1),
  title: z.string().trim().optional(),
  notesMd: z.string().optional(),
  reviewJson: z.any().optional(),
  result: z.enum(["win", "loss", "be", "no_trade"]).optional(),
  sumR: z.number().finite().optional(),
  discipline: z.number().int().min(0).max(10).optional(),
  confidence: z.number().int().min(0).max(10).optional()
});

const entryParamsSchema = z.object({
  entryId: z.string().trim().min(1)
});

const runParamsSchema = z.object({
  runId: z.string().trim().min(1)
});

const patchJournalBodySchema = z.object({
  title: z.string().trim().nullable().optional(),
  notesMd: z.string().nullable().optional(),
  reviewJson: z.any().optional(),
  result: z.enum(["win", "loss", "be", "no_trade"]).nullable().optional(),
  sumR: z.number().finite().nullable().optional(),
  discipline: z.number().int().min(0).max(10).nullable().optional(),
  confidence: z.number().int().min(0).max(10).nullable().optional()
});

const setTagsBodySchema = z.object({
  tags: z.array(z.string().trim().min(1)).min(1)
});

const tagParamsSchema = z.object({
  entryId: z.string().trim().min(1),
  tag: z.string().trim().min(1)
});

const db = prisma as any;

export async function journalRoutes(app: FastifyInstance): Promise<void> {
  // POST /journal
  app.post("/journal", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedBody = createJournalBodySchema.safeParse(request.body);
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

    const entry = await db.journalEntry.create({
      data: {
        runId: run.id,
        title: parsedBody.data.title ?? null,
        notesMd: parsedBody.data.notesMd ?? null,
        reviewJson: parsedBody.data.reviewJson ?? undefined,
        result: parsedBody.data.result ?? null,
        sumR: parsedBody.data.sumR ?? null,
        discipline: parsedBody.data.discipline ?? null,
        confidence: parsedBody.data.confidence ?? null
      },
      include: { tags: true }
    });

    return reply.status(201).send(ok({ entry }));
  });

  // GET /runs/:runId/journal
  app.get("/runs/:runId/journal", { preHandler: app.authenticate }, async (request, reply) => {
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

    const entries = await db.journalEntry.findMany({
      where: { runId: run.id },
      include: { tags: true },
      orderBy: { createdAt: "desc" }
    });

    return reply.send(ok({ entries }));
  });

  // PATCH /journal/:entryId
  app.patch("/journal/:entryId", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedParams = entryParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      const response = fail("BAD_REQUEST", "Invalid entryId", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedBody = patchJournalBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      const response = fail("BAD_REQUEST", "Invalid request body", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const existing = await db.journalEntry.findFirst({
      where: {
        id: parsedParams.data.entryId,
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
      const response = fail("JOURNAL_NOT_FOUND", "Journal entry not found", 404);
      return reply.status(response.statusCode).send(response.body);
    }

    const updateData: Record<string, unknown> = {};
    if (parsedBody.data.title !== undefined) updateData.title = parsedBody.data.title;
    if (parsedBody.data.notesMd !== undefined) updateData.notesMd = parsedBody.data.notesMd;
    if (parsedBody.data.reviewJson !== undefined) updateData.reviewJson = parsedBody.data.reviewJson;
    if (parsedBody.data.result !== undefined) updateData.result = parsedBody.data.result;
    if (parsedBody.data.sumR !== undefined) updateData.sumR = parsedBody.data.sumR;
    if (parsedBody.data.discipline !== undefined) updateData.discipline = parsedBody.data.discipline;
    if (parsedBody.data.confidence !== undefined) updateData.confidence = parsedBody.data.confidence;

    const entry = await db.journalEntry.update({
      where: { id: existing.id },
      data: updateData,
      include: { tags: true }
    });

    return reply.send(ok({ entry }));
  });

  // POST /journal/:entryId/tags
  app.post("/journal/:entryId/tags", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedParams = entryParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      const response = fail("BAD_REQUEST", "Invalid entryId", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedBody = setTagsBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      const response = fail("BAD_REQUEST", "Invalid request body", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const existing = await db.journalEntry.findFirst({
      where: {
        id: parsedParams.data.entryId,
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
      const response = fail("JOURNAL_NOT_FOUND", "Journal entry not found", 404);
      return reply.status(response.statusCode).send(response.body);
    }

    const uniqueTags = [...new Set(parsedBody.data.tags)];

    for (const tag of uniqueTags) {
      try {
        await db.journalTag.create({
          data: { entryId: existing.id, tag }
        });
      } catch (error: unknown) {
        const prismaError = error as { code?: string };
        if (prismaError.code !== "P2002") throw error;
      }
    }

    const tags = await db.journalTag.findMany({
      where: { entryId: existing.id },
      orderBy: { tag: "asc" }
    });

    return reply.status(201).send(ok({ tags }));
  });

  // GET /journal/:entryId/tags
  app.get("/journal/:entryId/tags", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedParams = entryParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      const response = fail("BAD_REQUEST", "Invalid entryId", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const existing = await db.journalEntry.findFirst({
      where: {
        id: parsedParams.data.entryId,
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
      const response = fail("JOURNAL_NOT_FOUND", "Journal entry not found", 404);
      return reply.status(response.statusCode).send(response.body);
    }

    const tags = await db.journalTag.findMany({
      where: { entryId: existing.id },
      orderBy: { tag: "asc" }
    });

    return reply.send(ok({ tags }));
  });

  // DELETE /journal/:entryId/tags/:tag
  app.delete("/journal/:entryId/tags/:tag", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedParams = tagParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      const response = fail("BAD_REQUEST", "Invalid params", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const existing = await db.journalEntry.findFirst({
      where: {
        id: parsedParams.data.entryId,
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
      const response = fail("JOURNAL_NOT_FOUND", "Journal entry not found", 404);
      return reply.status(response.statusCode).send(response.body);
    }

    const tagRecord = await db.journalTag.findUnique({
      where: {
        entryId_tag: {
          entryId: existing.id,
          tag: parsedParams.data.tag
        }
      }
    });

    if (!tagRecord) {
      const response = fail("TAG_NOT_FOUND", "Tag not found", 404);
      return reply.status(response.statusCode).send(response.body);
    }

    await db.journalTag.delete({
      where: { id: tagRecord.id }
    });

    const tags = await db.journalTag.findMany({
      where: { entryId: existing.id },
      orderBy: { tag: "asc" }
    });

    return reply.send(ok({ tags }));
  });
}
