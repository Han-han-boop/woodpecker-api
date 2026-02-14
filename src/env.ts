import "dotenv/config";
import { z } from "zod";

const parseBoolean = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return value;
}, z.boolean());

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(1),
  INVITE_CODE_REQUIRED: parseBoolean.default(true),
  AUTH_DISABLED: parseBoolean.default(false)
});

export const env = envSchema.parse(process.env);
