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
  useGitHubUrls: z.boolean().optional(),
  dataMode: z.enum(["github_real"]).optional(),
  symbol: z.string().trim().min(1).optional()
});

const nextQuerySchema = z.object({
  mode: z.enum(["unseen", "least_runs", "oldest"]).default("unseen")
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
    const dataMode = parsedBody.data.dataMode ?? null;

    const GITHUB_RAW = "https://raw.githubusercontent.com/Han-han-boop/woodpecker-data/main";

    if (dataMode === "github_real") {
      const symbol = parsedBody.data.symbol ?? block.symbol;
      const catalogRows = await db.sessionCatalog.findMany({
        where: { symbol, state: 1 },
        orderBy: { serie: "asc" }
      });

      if (catalogRows.length < block.sessionCount) {
        const response = fail(
          "CATALOG_NOT_ENOUGH_ROWS",
          `Need ${block.sessionCount} active catalog rows for "${symbol}", found ${catalogRows.length}`,
          400
        );
        return reply.status(response.statusCode).send(response.body);
      }

      let created = 0;
      let skipped = 0;

      await prisma.$transaction(async (tx) => {
        const trx = tx as any;
        for (let i = 0; i < block.sessionCount; i += 1) {
          const sessionNumber = i + 1;
          const catalog = catalogRows[i];
          const padded = String(sessionNumber).padStart(3, "0");
          const templateId = `tpl_${block.id}_${padded}`;
          const date = catalog.sessionDate;
          const serie = catalog.serie;

          const m1Url = `${GITHUB_RAW}/${symbol}/${serie}/m1/${date}_m1.csv`;
          const m15Url = `${GITHUB_RAW}/${symbol}/${serie}/m15/${date}_m15.csv`;
          const h4Url1 = `${GITHUB_RAW}/${symbol}/h4/H4_1.csv`;
          const h4Url2 = `${GITHUB_RAW}/${symbol}/h4/H4_2.csv`;
          const h4Url3 = `${GITHUB_RAW}/${symbol}/h4/H4_3.csv`;

          const existing = await trx.sessionTemplate.findUnique({
            where: { blockId_sessionNumber: { blockId: block.id, sessionNumber } }
          });

          if (existing) {
            await trx.sessionTemplate.update({
              where: { blockId_sessionNumber: { blockId: block.id, sessionNumber } },
              data: { id: templateId, date, sessionType, serie, m1Url, m15Url, h4Url1, h4Url2, h4Url3 }
            });
            skipped += 1;
          } else {
            await trx.sessionTemplate.create({
              data: { id: templateId, blockId: block.id, sessionNumber, date, sessionType, serie, m1Url, m15Url, h4Url1, h4Url2, h4Url3 }
            });
            created += 1;
          }
        }
      });

      return reply.send(
        ok({
          blockId: block.id,
          dataMode: "github_real",
          symbol,
          sessionType,
          created,
          skipped
        })
      );
    }

    // Legacy mode (existing behavior)
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

  app.get("/blocks/:blockId/next", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedParams = blockParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      const response = fail("BAD_REQUEST", "Invalid blockId", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedQuery = nextQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      const response = fail("BAD_REQUEST", "Invalid query: mode must be unseen, least_runs, or oldest", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const block = await db.block.findFirst({
      where: {
        id: parsedParams.data.blockId,
        ownerId: request.user.id
      },
      select: { id: true }
    });

    if (!block) {
      const response = fail("BLOCK_NOT_FOUND", "Block not found", 404);
      return reply.status(response.statusCode).send(response.body);
    }

    const templates = await db.sessionTemplate.findMany({
      where: { blockId: block.id },
      include: {
        _count: { select: { runs: true } },
        runs: {
          orderBy: { startedAt: "desc" as const },
          take: 1,
          select: { startedAt: true, result: true }
        }
      },
      orderBy: { sessionNumber: "asc" }
    });

    if (templates.length === 0) {
      const response = fail("NO_TEMPLATES", "No templates found for this block", 404);
      return reply.status(response.statusCode).send(response.body);
    }

    const mode = parsedQuery.data.mode;
    let selected: (typeof templates)[number] | null = null;

    if (mode === "unseen") {
      selected = templates.find((t: any) => t._count.runs === 0) ?? null;
    } else if (mode === "least_runs") {
      let minRuns = Infinity;
      for (const t of templates) {
        const count = (t as any)._count.runs;
        if (count < minRuns) {
          minRuns = count;
          selected = t;
        }
      }
    } else {
      // oldest: smallest lastRunAt; null (never run) has highest priority
      let pick: (typeof templates)[number] | null = null;
      let pickTime: Date | null = null; // null = never run = best

      for (const t of templates) {
        const lastRun = (t as any).runs[0] ?? null;
        if (!lastRun) {
          // never run — highest priority, pick first by sessionNumber
          if (pickTime !== null || !pick) {
            pick = t;
            pickTime = null;
          }
          continue;
        }
        const runTime = new Date(lastRun.startedAt);
        if (pickTime === null && pick) continue; // already have a never-run
        if (pickTime === null || runTime < pickTime) {
          pick = t;
          pickTime = runTime;
        }
      }
      selected = pick;
    }

    if (!selected) {
      const response = fail("NO_NEXT_SESSION", "All sessions have been seen", 404);
      return reply.status(response.statusCode).send(response.body);
    }

    const lastRun = (selected as any).runs[0] ?? null;
    const runsCount = (selected as any)._count.runs;

    // Strip _count and runs from the template response
    const { _count, runs, ...template } = selected as any;

    return reply.send(
      ok({
        template,
        runStats: {
          runsCount,
          lastRunAt: lastRun?.startedAt ?? null,
          lastResult: lastRun?.result ?? null
        },
        reason: mode
      })
    );
  });
}
