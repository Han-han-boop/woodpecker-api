import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { env } from "../env";
import { prisma } from "../lib/prisma";
import { verifyJwt } from "../lib/jwt";
import { fail } from "../lib/response";

type AuthenticatedUser = {
  id: string;
  email: string;
};

function readBearerToken(req: FastifyRequest): string | null {
  const authorization = req.headers.authorization;
  if (!authorization) return null;

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = match[1].trim();
  if (!token) return null;

  return token;
}

async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (env.AUTH_DISABLED) {
    const devUser = await prisma.user.upsert({
      where: { email: "dev@local" },
      update: {},
      create: { email: "dev@local" },
      select: { id: true, email: true }
    });

    req.user = {
      id: devUser.id,
      email: devUser.email
    };
    return;
  }

  const token = readBearerToken(req);

  if (!token) {
    const response = fail("UNAUTHORIZED", "Missing or invalid Authorization header", 401);
    return reply.status(response.statusCode).send(response.body);
  }

  const payload = verifyJwt(token, env.JWT_SECRET);
  if (!payload) {
    const response = fail("UNAUTHORIZED", "Invalid token", 401);
    return reply.status(response.statusCode).send(response.body);
  }

  req.user = {
    id: payload.sub,
    email: payload.email
  };
}

export const authPlugin = fp(async (app) => {
  app.decorateRequest("user", null);
  app.decorate("authenticate", authenticate);
});

export type { AuthenticatedUser };
