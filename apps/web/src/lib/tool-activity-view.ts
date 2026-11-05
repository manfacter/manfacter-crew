import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { MessageBlock } from "@rakazo/contracts";
import { isRetiredImportSetup, isToolActivityBlock } from "@rakazo/core";

const activityLabels = {
  admin_sales_context: msg({ id: "crew.activity.context", message: "Reading the sales brief" }),
  admin_find_records: msg({ id: "crew.activity.crm", message: "Consulting CRM records" }),
  admin_create_company: msg({ id: "crew.activity.company", message: "Saving a company" }),
  admin_create_contact: msg({ id: "crew.activity.contact", message: "Saving a contact" }),
  admin_create_opportunity: msg({
    id: "crew.activity.opportunity",
    message: "Creating an opportunity",
  }),
  admin_update_opportunity: msg({
    id: "crew.activity.next-step",
    message: "Updating the next step",
  }),
  admin_create_task: msg({ id: "crew.activity.task", message: "Saving an internal task" }),
  admin_save_draft: msg({ id: "crew.activity.draft", message: "Saving an email draft" }),
  find_tool: msg({ id: "crew.activity.find", message: "Checking available actions" }),
  message_bot: msg({ id: "crew.activity.coordinate", message: "Coordinating with a teammate" }),
  list_fleet: msg({ id: "crew.activity.team", message: "Checking the team" }),
  spawn_bot: msg({ id: "crew.activity.teammate", message: "Creating a teammate" }),
  update_bot: msg({ id: "crew.activity.profile", message: "Updating the profile" }),
  set_child_instructions: msg({ id: "crew.activity.role", message: "Updating a teammate's role" }),
  create_group: msg({ id: "crew.activity.group", message: "Creating a team conversation" }),
  ask_user: msg({ id: "crew.activity.question", message: "Asking a question" }),
  use_tool: msg({ id: "crew.activity.action", message: "Running an action" }),
  web_search: msg({ id: "crew.activity.search", message: "Searching public sources" }),
  web_fetch: msg({ id: "crew.activity.source", message: "Reading a source" }),
  scratchpad_add: msg({ id: "crew.activity.note", message: "Taking a work note" }),
};

export function toolStepLabel(label: string): string {
  const name = label
    .trim()
    .replace(/^Using (?:[^:]+: )?/, "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  const action = name.startsWith("mcp_") ? name.match(/_(admin_[a-z_]+)$/)?.[1] : name;
  const message =
    action && Object.hasOwn(activityLabels, action)
      ? activityLabels[action as keyof typeof activityLabels]
      : undefined;
  return message ? i18n._(message) : label;
}

/** Number of tool calls behind a steps block: the sum of each row's count. */
export function toolStepCount(steps: readonly { count: number }[]): number {
  return steps.reduce((total, step) => total + step.count, 0);
}

/**
 * Only a `steps` block becomes a card, and only when the preference is on.
 * A `progress` block marked `activity: true` never renders, in either mode.
 */
export function shouldRenderToolCard(block: MessageBlock, showToolActivity: boolean): boolean {
  return showToolActivity && block.kind === "steps";
}

/** Blocks that survive into a message render. */
export function renderableMessageBlocks(
  blocks: readonly MessageBlock[],
  showToolActivity: boolean,
): MessageBlock[] {
  return blocks.filter((block) => isShown(block, showToolActivity));
}

function isShown(block: MessageBlock, showToolActivity: boolean): boolean {
  if (isRetiredImportSetup(block)) return false;
  return !isToolActivityBlock(block) || shouldRenderToolCard(block, showToolActivity);
}

/**
 * True when a bot message's only visible blocks are tool cards, such as a live run that
 * has called tools but not written anything yet. Such a message renders as slim lines
 * between messages instead of inside a chat bubble.
 */
export function isToolOnlyNarration(
  blocks: readonly MessageBlock[],
  showToolActivity: boolean,
): boolean {
  const visible = renderableMessageBlocks(blocks, showToolActivity);
  return visible.length > 0 && visible.every((block) => block.kind === "steps");
}

/** True when a message still has at least one block to show under the preference. */
export function messageHasVisibleBlocks(
  blocks: readonly MessageBlock[],
  showToolActivity: boolean,
): boolean {
  return blocks.some((block) => isShown(block, showToolActivity));
}
