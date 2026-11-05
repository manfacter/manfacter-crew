import { chiefName, FIRST_BOT_NAMES, isFirstBot } from "@rakazo/core";
import { appendEventInTransaction, runAsSystem, runAsTenant } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { RouterDeps } from "./router.js";

export async function localizeFirstBots(
  deps: Pick<RouterDeps, "prisma" | "events">,
  userId: string,
  locale: string,
): Promise<void> {
  const name = chiefName(locale);
  const bots = await runAsSystem("localize the user's own coordinators", () =>
    deps.prisma.bot.findMany({
      where: {
        userId,
        archivedAt: null,
        name: { in: FIRST_BOT_NAMES, not: name },
        space: { deletingAt: null, memberships: { some: { userId } } },
      },
      select: {
        id: true,
        name: true,
        spawnKey: true,
        spaceId: true,
        thread: { select: { id: true } },
      },
    }),
  );
  for (const bot of bots) {
    if (!isFirstBot(bot) || !bot.thread) continue;
    const threadId = bot.thread.id;
    const seq = await runAsTenant({ spaceId: bot.spaceId, userId }, () =>
      deps.prisma.$transaction(async (tx) => {
        // An older language report must not rename the coordinator after a newer preference save.
        const [user] = await tx.$queryRaw<
          Array<{ locale: string | null }>
        >`SELECT locale FROM "user" WHERE id = ${userId} FOR SHARE`;
        if (user?.locale !== locale) return null;
        const [updated] = await tx.bot.updateManyAndReturn({
          where: { id: bot.id, spaceId: bot.spaceId, userId, name: { in: FIRST_BOT_NAMES } },
          data: { name },
          select: { id: true, name: true, description: true },
        });
        if (!updated) return null;
        const event = await appendEventInTransaction(tx, {
          spaceId: bot.spaceId,
          threadId,
          botId: bot.id,
          type: "bot.updated",
          payload: { botId: updated.id, name: updated.name, description: updated.description },
        });
        return event.seq;
      }),
    );
    if (seq !== null)
      await deps.events
        .notify(threadId, seq)
        .catch((error) => getLogger().error("coordinator locale notification", error));
  }
}
