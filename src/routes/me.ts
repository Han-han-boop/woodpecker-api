import type { FastifyInstance } from "fastify";
import { fail, ok } from "../lib/response";

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get("/me", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.user) {
      const response = fail("UNAUTHORIZED", "Invalid token", 401);
      return reply.status(response.statusCode).send(response.body);
    }

    return reply.send(
      ok({
        id: request.user.id,
        email: request.user.email
      })
    );
  });
}
