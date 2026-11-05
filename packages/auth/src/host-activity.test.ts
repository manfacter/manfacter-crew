import { createHmac } from "node:crypto";
import type { PrismaClient } from "@rakazo/db";
import { expect, it, vi } from "vitest";
import { readHostActivity } from "./host-session.js";

it("reports only live work in the signed user's spaces, without a new session or cross-user data", async () => {
  const config = {
    secret: "synthetic-secret-".repeat(5),
    origin: "http://localhost:3000",
  };
  const now = Math.floor(Date.now() / 1000);
  const used = new Set<string>();
  const findFirst = vi.fn().mockResolvedValue(null);
  const cleanup = vi.fn();
  const prisma = {
    verification: {
      deleteMany: cleanup,
      create: vi.fn(async ({ data }: { data: { id: string } }) => {
        if (used.has(data.id)) throw { code: "P2002" };
        used.add(data.id);
      }),
    },
    run: { findFirst },
  } as unknown as PrismaClient;
  function assertion(subject: string, nonce: string, key = config.secret) {
    const body = [
      { alg: "HS256", typ: "JWT" },
      {
        iss: config.origin,
        aud: "manfacter-crew",
        sub: subject,
        sid: "22222222-2222-4222-a222-222222222222",
        name: "Synthetic user",
        iat: now,
        exp: now + 30,
        session_exp: now + 75,
        jti: nonce.repeat(43),
      },
    ]
      .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
      .join(".");
    return `${body}.${createHmac("sha256", key).update(body).digest("base64url")}`;
  }
  const user = "11111111-1111-4111-a111-111111111111";
  await expect(
    readHostActivity(prisma, config, assertion(user, "a", "forged")),
  ).rejects.toThrow();
  expect(findFirst).not.toHaveBeenCalled();
  const token = assertion(user, "b");
  await expect(readHostActivity(prisma, config, token)).resolves.toEqual({
    working: false,
    needsInput: false,
  });
  const filter = findFirst.mock.calls[0]![0];
  expect(filter).toMatchObject({
    where: {
      status: "running",
      leaseExpiresAt: { gt: expect.any(Date) },
      bot: { archivedAt: null, space: { deletingAt: null } },
    },
    select: { id: true },
  });
  expect(cleanup).toHaveBeenCalledWith({
    where: {
      identifier: "host-session-used",
      expiresAt: { lt: expect.any(Date) },
    },
  });
  await expect(readHostActivity(prisma, config, token)).rejects.toThrow();
  expect(findFirst).toHaveBeenCalledTimes(2);
  expect(findFirst.mock.calls[1]![0]).toMatchObject({
    where: { status: "waiting_input", bot: filter.where.bot },
    select: { id: true },
  });
  findFirst.mockImplementation(async ({ where }) =>
    where.status === "waiting_input" ? { id: "synthetic-question" } : null,
  );
  await expect(
    readHostActivity(
      prisma,
      config,
      assertion("33333333-3333-4333-a333-333333333333", "c"),
    ),
  ).resolves.toEqual({ working: false, needsInput: true });
  expect(
    findFirst.mock.calls[2]![0].where.bot.space.memberships.some.userId,
  ).not.toBe(filter.where.bot.space.memberships.some.userId);
  findFirst.mockImplementation(async ({ where }) =>
    where.status === "running" ? { id: "synthetic-resumed-run" } : null,
  );
  await expect(readHostActivity(prisma, config, assertion(user, "d"))).resolves.toEqual({
    working: true, needsInput: false,
  });
});
