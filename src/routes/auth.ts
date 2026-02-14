import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env";
import { signJwt } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { fail, ok } from "../lib/response";

const loginBodySchema = z.object({
  email: z.string().trim().email(),
  inviteCode: z.string().trim().min(1).optional()
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/login", async (request, reply) => {
    const parsedBody = loginBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      const response = fail("BAD_REQUEST", "Invalid request body", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const normalizedEmail = parsedBody.data.email.trim().toLowerCase();
    const inviteCodeInput = parsedBody.data.inviteCode?.trim();

    if (env.INVITE_CODE_REQUIRED && !inviteCodeInput) {
      const response = fail("INVALID_INVITE_CODE", "Invite code is required", 400);
      return reply.status(response.statusCode).send(response.body);
    }

    const now = new Date();

    let user: { id: string; email: string };

    try {
      user = await prisma.$transaction(async (tx) => {
        const db = tx as any;

        if (env.INVITE_CODE_REQUIRED) {
          const invite = await db.inviteCode.findUnique({
            where: { code: inviteCodeInput! }
          });

          if (!invite || invite.status !== "active") {
            throw new Error("INVALID_INVITE_CODE");
          }

          if (invite.expiresAt && invite.expiresAt <= now) {
            throw new Error("INVALID_INVITE_CODE");
          }

          if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
            throw new Error("INVALID_INVITE_CODE");
          }

          await db.inviteCode.update({
            where: { id: invite.id },
            data: { uses: { increment: 1 } }
          });
        }

        return db.user.upsert({
          where: { email: normalizedEmail },
          update: {},
          create: { email: normalizedEmail },
          select: { id: true, email: true }
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_INVITE_CODE") {
        const response = fail("INVALID_INVITE_CODE", "Invalid or expired invite code", 400);
        return reply.status(response.statusCode).send(response.body);
      }

      throw error;
    }

    const token = signJwt({ sub: user.id, email: user.email }, env.JWT_SECRET);

    return reply.send(
      ok({
        token,
        user
      })
    );
  });
}
