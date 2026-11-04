import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@rakazo/db";
import { bootstrapUserSpace } from "@rakazo/db";
import {
  APIError,
  createAuthEndpoint,
  getSessionFromCtx,
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";

export interface HostSessionConfig {
  secret: string;
  origin: string;
}
export const HOST_SESSION_SECONDS = 75;
const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url");
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const invalid = () =>
  new APIError("UNAUTHORIZED", { message: "Host session required" });

export function hostSessionConfig(
  secret?: string,
  origin?: string,
): HostSessionConfig | undefined {
  if (!secret && !origin) return undefined;
  if (!secret || secret.length < 64 || !origin)
    throw new Error("Host session configuration incomplete");
  const url = new URL(origin);
  if (
    url.origin !== origin ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  )
    throw new Error(
      "Host session origin must be an exact HTTPS or loopback origin",
    );
  return { secret, origin };
}

export function verifyHostSessionAssertion(
  value: unknown,
  config: HostSessionConfig,
  now = Math.floor(Date.now() / 1000),
) {
  if (typeof value !== "string" || value.length > 2048) throw invalid();
  const parts = value.split(".");
  if (
    parts.length !== 3 ||
    parts[0] !== header ||
    !/^[a-zA-Z0-9_-]+$/.test(parts[1]!) ||
    !/^[a-zA-Z0-9_-]{43}$/.test(parts[2]!)
  )
    throw invalid();
  const expected = createHmac("sha256", config.secret)
    .update(`${parts[0]}.${parts[1]}`)
    .digest();
  const signature = Buffer.from(parts[2]!, "base64url");
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(expected, signature)
  )
    throw invalid();
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8"));
  } catch {
    throw invalid();
  }
  if (
    !claims ||
    Object.keys(claims).sort().join() !==
      "aud,exp,iat,iss,jti,name,session_exp,sid,sub" ||
    claims.iss !== config.origin ||
    claims.aud !== "manfacter-crew" ||
    typeof claims.sub !== "string" ||
    !uuid.test(claims.sub) ||
    typeof claims.sid !== "string" ||
    !uuid.test(claims.sid) ||
    typeof claims.jti !== "string" ||
    !/^[a-zA-Z0-9_-]{43}$/.test(claims.jti) ||
    typeof claims.name !== "string" ||
    !claims.name.trim() ||
    claims.name.length > 160 ||
    ![claims.iat, claims.exp, claims.session_exp].every(
      (v) => typeof v === "number" && Number.isSafeInteger(v),
    ) ||
    Number(claims.iat) > now + 2 ||
    Number(claims.exp) <= now ||
    Number(claims.exp) - Number(claims.iat) > 30 ||
    Number(claims.exp) <= Number(claims.iat) ||
    Number(claims.session_exp) < Number(claims.exp) ||
    Number(claims.session_exp) > Number(claims.iat) + HOST_SESSION_SECONDS
  )
    throw invalid();
  return claims as {
    sub: string;
    sid: string;
    jti: string;
    name: string;
    exp: number;
    session_exp: number;
  };
}

function hostUserId(config: HostSessionConfig, subject: string) {
  return `hs_${createHash("sha256").update(`${config.origin}:${subject}`).digest("hex").slice(0, 32)}`;
}

async function consumeHostAssertion(
  prisma: PrismaClient,
  config: HostSessionConfig,
  value: unknown,
) {
  const claims = verifyHostSessionAssertion(value, config);
  await prisma.verification.deleteMany({
    where: { identifier: "host-session-used", expiresAt: { lt: new Date() } },
  });
  // The existing primary key makes one-use consumption atomic across API processes.
  try {
    await prisma.verification.create({
      data: {
        id: `host-${createHash("sha256").update(claims.jti).digest("hex")}`,
        identifier: "host-session-used",
        value: "used",
        expiresAt: new Date(claims.exp * 1000),
      },
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    )
      throw invalid();
    throw error;
  }
  return claims;
}

export async function readHostActivity(
  prisma: PrismaClient,
  config: HostSessionConfig,
  assertion: unknown,
) {
  const claims = await consumeHostAssertion(prisma, config, assertion);
  const run = await prisma.run.findFirst({
    where: {
      status: "running",
      leaseExpiresAt: { gt: new Date() },
      bot: {
        archivedAt: null,
        space: {
          deletingAt: null,
          memberships: { some: { userId: hostUserId(config, claims.sub) } },
        },
      },
    },
    select: { id: true },
  });
  return { working: run !== null };
}

export function hostSession(prisma: PrismaClient, config: HostSessionConfig) {
  return {
    id: "host-session",
    endpoints: {
      hostSessionConfig: createAuthEndpoint(
        "/host-session/config",
        { method: "GET" },
        async (ctx) => ctx.json({ origin: config.origin }),
      ),
      hostActivity: createAuthEndpoint(
        "/host-activity",
        { method: "POST" },
        async (ctx) => {
          const body = ctx.body as { assertion?: unknown } | undefined;
          if (!body || Object.keys(body).join() !== "assertion")
            throw invalid();
          return ctx.json(
            await readHostActivity(prisma, config, body.assertion),
          );
        },
      ),
      hostSession: createAuthEndpoint(
        "/host-session",
        { method: "POST" },
        async (ctx) => {
          if (
            ctx.headers?.get("origin") !== new URL(ctx.context.baseURL).origin
          )
            throw invalid();
          const body = ctx.body as { assertion?: unknown } | undefined;
          if (!body || Object.keys(body).join() !== "assertion")
            throw invalid();
          const claims = await consumeHostAssertion(
            prisma,
            config,
            body.assertion,
          );
          const userId = hostUserId(config, claims.sub);
          // Internal aliases never claim a person's mailbox or link an existing email account.
          await prisma.user.upsert({
            where: { id: userId },
            create: {
              id: userId,
              name: claims.name,
              email: `${userId}@host-session.invalid`,
              emailVerified: true,
              accounts: {
                create: {
                  id: `host-${userId}`,
                  providerId: "host-session",
                  accountId: claims.sub,
                },
              },
            },
            update: { name: claims.name },
          });
          await bootstrapUserSpace(
            prisma,
            { id: userId },
            { signupsEnabled: "false", signupAllowlist: "" },
          );
          const user = await ctx.context.internalAdapter.findUserById(userId);
          if (!user) throw invalid();
          const current = await getSessionFromCtx(ctx);
          const expiresAt = new Date(
            Math.min(
              claims.session_exp * 1000,
              Date.now() + HOST_SESSION_SECONDS * 1000,
            ),
          );
          const session =
            current?.user.id === userId
              ? await ctx.context.internalAdapter.updateSession(
                  current.session.token,
                  { expiresAt },
                )
              : await ctx.context.internalAdapter.createSession(
                  userId,
                  false,
                  { expiresAt },
                  true,
                );
          if (!session) throw invalid();
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ ok: true, expiresAt: expiresAt.toISOString() });
        },
      ),
    },
  };
}
