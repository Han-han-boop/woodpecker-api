import Fastify from "fastify";
import { healthRoutes } from "./routes/health";
import { authPlugin } from "./plugins/auth";
import { authRoutes } from "./routes/auth";
import { blockRoutes } from "./routes/blocks";
import { meRoutes } from "./routes/me";
import { runRoutes } from "./routes/runs";
import { fail } from "./lib/response";

export function buildServer() {
  const app = Fastify({ logger: true });

  app.register(authPlugin);
  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(meRoutes);
  app.register(blockRoutes);
  app.register(runRoutes);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);

    const response = fail("INTERNAL_ERROR", "An unexpected error occurred", 500);
    reply.status(response.statusCode).send(response.body);
  });

  return app;
}
