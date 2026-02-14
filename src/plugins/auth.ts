import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { createHmac } from "node:crypto";
import { env } from "../env";
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
    req.user = {
      id: "dev-user",
      email: "dev@local"
    };
    return;
  }

  req.log.info({ authHeader: req.headers.authorization }, "AUTH header received");
  const token = readBearerToken(req);
  req.log.info({ tokenLen: token?.length, tokenStart: token?.slice(0, 16) }, "JWT token extracted");

  if (!token) {
    const response = fail("UNAUTHORIZED", "Missing or invalid Authorization header", 401);
    return reply.status(response.statusCode).send(response.body);
  }

  const parts = token.split(".");
  const providedSignature = parts[2];
  const expectedSignature =
    parts.length === 3 ? createHmac("sha256", env.JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest("base64url") : null;
  req.log.info(
    {
      tokenPartCount: parts.length,
      headerLen: parts[0]?.length,
      payloadLen: parts[1]?.length,
      providedSigLen: providedSignature?.length,
      expectedSigLen: expectedSignature?.length,
      sigMatch: expectedSignature ? expectedSignature === providedSignature : false
    },
    "JWT verification pre-check"
  );

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

export const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("user", null);
  app.decorate("authenticate", authenticate);
};

export type { AuthenticatedUser };
