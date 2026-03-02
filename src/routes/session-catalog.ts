import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { fail, ok } from "../lib/response";

const db = prisma as any;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeSerie(raw: string): string {
  const upper = raw.trim().toUpperCase();
  const match = upper.match(/^G(\d+)$/);
  if (!match) return upper;
  return "G" + match[1].padStart(3, "0");
}

const importBodySchema = z.object({
  symbol: z.string().trim().min(1),
  rows: z.array(
    z.object({
      serie: z.string().trim().min(1),
      session_date: z.string().trim().regex(DATE_RE),
      etat: z.number().int()
    })
  ).min(1)
});

const listQuerySchema = z.object({
  symbol: z.string().trim().min(1)
});

export async function sessionCatalogRoutes(app: FastifyInstance): Promise<void> {

  app.post("/session-catalog/import", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedBody = importBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      const response = fail("BAD_REQUEST", "Invalid request body", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const { symbol, rows } = parsedBody.data;
    let imported = 0;

    await prisma.$transaction(async (tx) => {
      const trx = tx as any;
      for (const row of rows) {
        const serie = normalizeSerie(row.serie);
        await trx.sessionCatalog.upsert({
          where: { symbol_serie: { symbol, serie } },
          update: {
            sessionDate: row.session_date,
            state: row.etat
          },
          create: {
            symbol,
            serie,
            sessionDate: row.session_date,
            state: row.etat
          }
        });
        imported += 1;
      }
    });

    return reply.send(ok({ imported, symbol }));
  });

  app.get("/session-catalog", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    const parsedQuery = listQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      const response = fail("BAD_REQUEST", "Query parameter 'symbol' is required", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const rows = await db.sessionCatalog.findMany({
      where: { symbol: parsedQuery.data.symbol },
      orderBy: { serie: "asc" }
    });

    return reply.send(ok({ rows }));
  });
}
