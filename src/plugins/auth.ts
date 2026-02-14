import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../env";
import { verifyJwt } from "../lib/jwt";
import { fail } from "../lib/response";

type AuthenticatedUser = {
  id: string;
  email: string;
};

function readBearerToken(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (!authorization) return null;

  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) return null;

  return token;
}

async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = readBearerToken(request);

  if (!token) {
    const response = fail("UNAUTHORIZED", "Missing or invalid Authorization header", 401);
    return reply.status(response.statusCode).send(response.body);
  }

  const payload = verifyJwt(token, env.JWT_SECRET);
  if (!payload) {
    const response = fail("UNAUTHORIZED", "Invalid token", 401);
    return reply.status(response.statusCode).send(response.body);
  }

  request.user = {
    id: payload.sub,
    email: payload.email
  };
}

export const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("user", null);
  app.decorate("authenticate", authenticate);
};

export type { AuthenticatedUser };
