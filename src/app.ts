import Fastify from "fastify";
import { healthRoutes } from "./routes/health";
import { fail } from "./lib/response";

export function buildServer() {
  const app = Fastify({ logger: true });

  app.register(healthRoutes);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);

    const response = fail("INTERNAL_ERROR", "An unexpected error occurred", 500);
    reply.status(response.statusCode).send(response.body);
  });

  return app;
}