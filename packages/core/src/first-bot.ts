import { AppLocaleSchema } from "@rakazo/contracts";
import { matchUiLocale } from "./ui-locale.js";

export const FIRST_BOT_SPAWN_KEY = "onboarding:first";
const names = {
  en: "Chief",
  es: "Jefe de equipo",
  de: "Teamleitung",
  fr: "Chef d’équipe",
  ko: "팀장",
  tr: "Ekip lideri",
  hi: "टीम प्रमुख",
  "pt-BR": "Líder da equipe",
  "zh-CN": "团队负责人",
  "zh-TW": "團隊負責人",
  ru: "Руководитель команды",
  he: "ראש הצוות",
  nl: "Teamleider",
  ja: "チームリーダー",
  pl: "Kierownik zespołu",
} satisfies Record<(typeof AppLocaleSchema.options)[number], string>;
export const FIRST_BOT_NAMES = Object.values(names);

export function chiefName(locale: string | null | undefined): string {
  return names[matchUiLocale(locale, AppLocaleSchema.options)];
}

export function isFirstBot(bot: { name: string; spawnKey?: string | null }): boolean {
  return (
    bot.spawnKey === FIRST_BOT_SPAWN_KEY || (!bot.spawnKey && FIRST_BOT_NAMES.includes(bot.name))
  );
}

export const CHIEF_INSTRUCTIONS =
  "You are the user's team coordinator in Manfacter Crew. Help them through ordinary conversation. When asked to organize a team, inspect the existing fleet first, then use the native fleet tools to create, configure and coordinate the bots and groups needed for the goal; reuse suitable existing bots. Give each bot a clear role, scope, instructions and handoff. Delegate specialist work instead of doing the whole department's work yourself. Carry out the requested setup, delegation and review; do not ask whether to continue steps the user already requested. Keep implementation details, raw tool names and internal identifiers out of the conversation; use plain descriptions and record links. Make reasonable routine choices from the user's brief; ask only when essential information or a real authorization is missing. Verify tool results before reporting completed work. Retain the platform's permissions and approvals. Never claim that planning or creating a bot has completed the user's business task.";

export function conversationLanguageInstruction(
  locale: string | null | undefined,
): string | undefined {
  if (!locale) return undefined;
  const language = matchUiLocale(locale, AppLocaleSchema.options);
  return `The user's selected app language is ${language}. Use it for your initial greeting, questions, options and replies. Continue in the conversation's last clearly established user language. Change language only when the user clearly writes a substantive message in another language or explicitly requests it. Short acknowledgements, names, URLs, code, quoted text, internal instructions and tool results do not establish a language change.`;
}
