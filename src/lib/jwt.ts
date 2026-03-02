import { createHmac, timingSafeEqual } from "node:crypto";

function toBase64Url(value: Buffer | string): string {
  const base64 = Buffer.isBuffer(value) ? value.toString("base64") : Buffer.from(value).toString("base64");
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64Url(value: string): Buffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const normalized = pad === 0 ? base64 : base64 + "=".repeat(4 - pad);
  return Buffer.from(normalized, "base64");
}

function constantTimeStringMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export type JwtPayload = {
  sub: string;
  email: string;
  iat: number;
  exp: number;
};

export function signJwt(
  payload: Pick<JwtPayload, "sub" | "email">,
  secret: string,
  expiresInSeconds = 86400
): string {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? Math.floor(expiresInSeconds) : 86400;
  const tokenPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + ttl
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(tokenPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");

  return `${signingInput}.${signature}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, providedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createHmac("sha256", secret).update(signingInput).digest("base64url");

  if (!constantTimeStringMatch(expectedSignature, providedSignature)) {
    return null;
  }

  try {
    const header = JSON.parse(fromBase64Url(encodedHeader).toString("utf8")) as { alg?: string; typ?: string };
    if (header.alg !== "HS256" || header.typ !== "JWT") {
      return null;
    }

    const payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8")) as Partial<JwtPayload>;
    const iat = payload.iat;
    const exp = payload.exp;

    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof iat !== "number" ||
      typeof exp !== "number" ||
      !Number.isInteger(iat) ||
      !Number.isInteger(exp)
    ) {
      return null;
    }

    if (exp <= iat) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (exp < now) {
      return null;
    }

    return { sub: payload.sub, email: payload.email, iat, exp };
  } catch {
    return null;
  }
}
