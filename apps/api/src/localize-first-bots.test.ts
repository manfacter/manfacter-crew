import { appendEventInTransaction } from "@rakazo/db";
import { expect, it, vi } from "vitest";
import { localizeFirstBots } from "./localize-first-bots.js";

vi.mock("@rakazo/db", () => ({
  runAsSystem: (_reason: string, action: () => unknown) => action(),
  runAsTenant: (_scope: unknown, action: () => unknown) => action(),
  appendEventInTransaction: vi.fn(async () => ({ seq: 9 })),
}));

function fixture(locale = "es", changedByHuman = false) {
  const write = vi.fn(async (_input: unknown) =>
    changedByHuman ? [] : [{ id: "bot", name: "Jefe de equipo", description: "" }],
  );
  const transaction = {
    $queryRaw: vi.fn(async () => [{ locale }]),
    bot: { updateManyAndReturn: write },
  };
  const list = vi.fn(async (_input: unknown) => [
    {
      id: "bot",
      name: "Chief",
      spawnKey: "onboarding:first",
      spaceId: "space",
      thread: { id: "thread" },
    },
  ]);
  const notify = vi.fn(async () => {});
  const deps = {
    prisma: {
      bot: { findMany: list },
      $transaction: (action: (tx: unknown) => unknown) => action(transaction),
    },
    events: { notify },
  };
  return { deps: deps as unknown as Parameters<typeof localizeFirstBots>[0], write, list, notify };
}

it("renames only the authenticated owner's default coordinator and publishes the native update", async () => {
  vi.mocked(appendEventInTransaction).mockClear();
  const f = fixture();
  await localizeFirstBots(f.deps, "owner", "es");
  expect(f.list.mock.calls[0]?.[0]).toMatchObject({
    where: {
      userId: "owner",
      archivedAt: null,
      space: { deletingAt: null, memberships: { some: { userId: "owner" } } },
    },
  });
  expect(f.write.mock.calls[0]?.[0]).toMatchObject({
    where: { id: "bot", spaceId: "space", userId: "owner" },
    data: { name: "Jefe de equipo" },
  });
  expect(appendEventInTransaction).toHaveBeenCalledOnce();
  expect(f.notify).toHaveBeenCalledWith("thread", 9);
});
it("does not overwrite a newer locale or a name the human customized before commit", async () => {
  const newer = fixture("de");
  await localizeFirstBots(newer.deps, "owner", "es");
  expect(newer.write).not.toHaveBeenCalled();
  expect(newer.notify).not.toHaveBeenCalled();
  const edited = fixture("es", true);
  await localizeFirstBots(edited.deps, "owner", "es");
  expect(edited.notify).not.toHaveBeenCalled();
});

it("leaves a regular bot with a matching name alone", async () => {
  const f = fixture();
  f.list.mockResolvedValue([
    { id: "bot", name: "Chief", spawnKey: "custom", spaceId: "space", thread: { id: "thread" } },
  ]);
  await localizeFirstBots(f.deps, "owner", "es");
  expect(f.write).not.toHaveBeenCalled();
});
