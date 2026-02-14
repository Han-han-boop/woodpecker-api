import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { fail, ok } from "../lib/response";

const blockParamsSchema = z.object({
  blockId: z.string().trim().min(1)
});

const createBlockBodySchema = z.object({
  name: z.string().trim().min(1),
  symbol: z.string().trim().min(1),
  sessionCount: z.number().int().positive().optional()
});

const generateTemplatesBodySchema = z.object({
  sessionType: z.string().trim().min(1).optional(),
  startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  useGitHubUrls: z.boolean().optional()
});

const db = prisma as any;

function isValidDateString(value: string): boolean {
  const [yearString, monthString, dayString] = value.split("-");
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function addDaysToIsoDate(value: string, days: number): string {
  const [yearString, monthString, dayString] = value.split("-");
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export async function blockRoutes(app: FastifyInstance): Promise<void> {
  app.post("/blocks", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedBody = createBlockBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      const response = fail("BAD_REQUEST", "Invalid request body", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const block = await db.block.create({
      data: {
        ownerId: request.user.id,
        name: parsedBody.data.name.trim(),
        symbol: parsedBody.data.symbol.trim(),
        sessionCount: parsedBody.data.sessionCount ?? 100
      }
    });

    return reply.send(ok({ block }));
  });

  app.post("/blocks/:blockId/generate", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedParams = blockParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      const response = fail("BAD_REQUEST", "Invalid blockId", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedBody = generateTemplatesBodySchema.safeParse(request.body ?? {});
    if (!parsedBody.success) {
      const response = fail("BAD_REQUEST", "Invalid request body", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    if (parsedBody.data.startDate && !isValidDateString(parsedBody.data.startDate)) {
      const response = fail("BAD_REQUEST", "Invalid startDate", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const block = await db.block.findFirst({
      where: {
        id: parsedParams.data.blockId,
        ownerId: request.user.id
      },
      select: {
        id: true,
        symbol: true,
        sessionCount: true
      }
    });

    if (!block) {
      const response = fail("BLOCK_NOT_FOUND", "Block not found", 404);
      return reply.status(response.statusCode).send(response.body);
    }

    const sessionType = parsedBody.data.sessionType ?? "custom";
    const useGitHubUrls = parsedBody.data.useGitHubUrls ?? false;

    await prisma.$transaction(async (tx) => {
      const trx = tx as any;
      for (let sessionNumber = 1; sessionNumber <= block.sessionCount; sessionNumber += 1) {
        const padded = String(sessionNumber).padStart(3, "0");
        const templateId = `tpl_${block.id}_${padded}`;
        const date = parsedBody.data.startDate ? addDaysToIsoDate(parsedBody.data.startDate, sessionNumber - 1) : null;
        const githubBase = `https://github.com/woodpecker-api/session-assets/${templateId}`;

        await trx.sessionTemplate.upsert({
          where: {
            blockId_sessionNumber: {
              blockId: block.id,
              sessionNumber
            }
          },
          update: {
            id: templateId,
            date,
            sessionType,
            m1Url: useGitHubUrls ? `${githubBase}/m1` : null,
            m15Url: useGitHubUrls ? `${githubBase}/m15` : null,
            h4Url: useGitHubUrls ? `${githubBase}/h4` : null
          },
          create: {
            id: templateId,
            blockId: block.id,
            sessionNumber,
            date,
            sessionType,
            m1Url: useGitHubUrls ? `${githubBase}/m1` : null,
            m15Url: useGitHubUrls ? `${githubBase}/m15` : null,
            h4Url: useGitHubUrls ? `${githubBase}/h4` : null
          }
        });
      }
    });

    return reply.send(
      ok({
        blockId: block.id,
        generatedCount: block.sessionCount,
        sessionType,
        useGitHubUrls,
        startDate: parsedBody.data.startDate ?? null,
        dateStrategy: parsedBody.data.startDate ? "sequential_from_start_date" : "null_dates"
      })
    );
  });

  app.get("/blocks/:blockId/templates", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedParams = blockParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      const response = fail("BAD_REQUEST", "Invalid blockId", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const block = await db.block.findFirst({
      where: {
        id: parsedParams.data.blockId,
        ownerId: request.user.id
      },
      select: {
        id: true
      }
    });

    if (!block) {
      const response = fail("BLOCK_NOT_FOUND", "Block not found", 404);
      return reply.status(response.statusCode).send(response.body);
    }

    const templates = await db.sessionTemplate.findMany({
      where: {
        blockId: block.id
      },
      orderBy: {
        sessionNumber: "asc"
      }
    });

    return reply.send(ok({ templates }));
  });
}
