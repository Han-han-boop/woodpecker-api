import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { fail, ok } from "../lib/response";
import { z } from "zod";

const createRunBodySchema = z.object({
  templateId: z.string().trim().min(1)
});

const endRunParamsSchema = z.object({
  runId: z.string().trim().min(1)
});

const endRunBodySchema = z.object({
  result: z.enum(["win", "loss", "be", "no_trade"]),
  sumR: z.number().finite().optional()
});

const templateParamsSchema = z.object({
  templateId: z.string().trim().min(1)
});

const db = prisma as any;

function isUniqueConstraintError(error: unknown): error is { code: string; meta?: { target?: string[] } } {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002";
}

function randomSuffix(length = 6): string {
  return Math.random().toString(36).slice(2, 2 + length);
}

export async function runRoutes(app: FastifyInstance): Promise<void> {
  app.post("/runs", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedBody = createRunBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      const response = fail("BAD_REQUEST", "Invalid request body", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const template = await db.sessionTemplate.findFirst({
      where: {
        id: parsedBody.data.templateId,
        block: {
          ownerId: request.user.id
        }
      },
      select: {
        id: true
      }
    });

    if (!template) {
      const response = fail("TEMPLATE_NOT_FOUND", "Template not found", 404);
      return reply.status(response.statusCode).send(response.body);
    }

    const now = new Date();
    const maxAttempts = 6;
    let run = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const aggregate = await db.sessionRun.aggregate({
        where: { templateId: template.id },
        _max: { runIndex: true }
      });
      const runIndex = (aggregate._max.runIndex ?? 0) + 1;
      const baseRunId = `run_${template.id}_${runIndex}`;
      const runId = attempt === 0 ? baseRunId : `${baseRunId}_${randomSuffix()}`;

      try {
        run = await db.sessionRun.create({
          data: {
            id: runId,
            templateId: template.id,
            runIndex,
            startedAt: now
          }
        });
        break;
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    if (!run) {
      const response = fail("CONFLICT", "Could not allocate a unique runId", 409);
      return reply.status(response.statusCode).send(response.body);
    }

    return reply.send(ok({ run }));
  });

  app.post("/runs/:runId/end", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedParams = endRunParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      const response = fail("BAD_REQUEST", "Invalid runId", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedBody = endRunBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      const response = fail("BAD_REQUEST", "Invalid request body", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const existingRun = await db.sessionRun.findFirst({
      where: {
        id: parsedParams.data.runId,
        template: {
          block: {
            ownerId: request.user.id
          }
        }
      },
      select: {
        id: true,
        endedAt: true
      }
    });

    if (!existingRun) {
      const response = fail("RUN_NOT_FOUND", "Run not found", 404);
      return reply.status(response.statusCode).send(response.body);
    }

    if (existingRun.endedAt) {
      const response = fail("RUN_ALREADY_ENDED", "Run is already ended", 409);
      return reply.status(response.statusCode).send(response.body);
    }

    const run = await db.sessionRun.update({
      where: { id: existingRun.id },
      data: {
        endedAt: new Date(),
        result: parsedBody.data.result,
        sumR: parsedBody.data.sumR ?? null
      }
    });

    return reply.send(ok({ run }));
  });

  app.get("/templates/:templateId/runs", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedParams = templateParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      const response = fail("BAD_REQUEST", "Invalid templateId", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const template = await db.sessionTemplate.findFirst({
      where: {
        id: parsedParams.data.templateId,
        block: {
          ownerId: request.user.id
        }
      },
      select: {
        id: true
      }
    });

    if (!template) {
      const response = fail("TEMPLATE_NOT_FOUND", "Template not found", 404);
      return reply.status(response.statusCode).send(response.body);
    }

    const runs = await db.sessionRun.findMany({
      where: {
        templateId: template.id
      },
      orderBy: {
        runIndex: "desc"
      }
    });

    return reply.send(ok({ runs }));
  });
}
