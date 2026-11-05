import { describe, expect, it } from "vitest";
import {
  CORE_BUILTIN_TOOL_NAMES,
  FIND_TOOL,
  findTools,
  partitionTools,
  USE_TOOL,
} from "./builtin-tool-bridge.js";
import { builtinAgentTools } from "./builtin-tools.js";
import { DIRECT_TOOL_LIMIT } from "./lazy-tool-catalog.js";
import { describeToolActivity } from "./pi-runtime-tools.js";
import { BUILTIN_AGENT_TOOL_NAMES, selectBuiltinToolsForRun } from "./run-tool-selection.js";

const ownerChat = selectBuiltinToolsForRun({
  graphicalToolsAllowed: false,
  groupId: null,
  trigger: "user",
  semanticMemoryEnabled: false,
  historyRetrievalEnabled: true,
  messagingChannelRun: false,
  fleetManagement: true,
  followUpFromUser: true,
});

const definitionBytes = (tools: typeof ownerChat) =>
  Buffer.byteLength(
    JSON.stringify(
      tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    ),
  );

describe("built-in tool bridge", () => {
  it("exposes a small granted team tool set directly, without discovery wrappers", () => {
    const granted = builtinAgentTools.filter((tool) =>
      ["message_bot", "handoff_to_bot", "task_catalog"].includes(tool.name),
    );
    expect(granted).toHaveLength(3);
    expect(partitionTools(granted)).toEqual({ listed: granted, deferred: [] });
  });

  it("keeps the existing lazy catalog above the shared direct-tool limit", () => {
    const deferred = builtinAgentTools
      .filter((tool) => !CORE_BUILTIN_TOOL_NAMES.has(tool.name))
      .slice(0, DIRECT_TOOL_LIMIT + 1);
    expect(deferred).toHaveLength(DIRECT_TOOL_LIMIT + 1);
    expect(partitionTools(deferred.slice(0, DIRECT_TOOL_LIMIT))).toEqual({
      listed: deferred.slice(0, DIRECT_TOOL_LIMIT),
      deferred: [],
    });
    expect(partitionTools(deferred).deferred).toEqual(deferred);
  });
  it("lists a pinned tool set within a byte budget on an owner chat run", () => {
    const { listed, deferred } = partitionTools(ownerChat);
    expect(listed.map((tool) => tool.name).sort()).toEqual([
      "archive_bot",
      "ask_user",
      "attach_file",
      "connect_app",
      "create_group",
      "find_tool",
      "handoff_to_bot",
      "list_files",
      "list_fleet",
      "message_bot",
      "message_user",
      "organize_bot",
      "read_file",
      "read_history",
      "remember",
      "request_secret",
      "request_takeover",
      "run_subagent",
      "schedule_create",
      "schedule_list",
      "search_history",
      "set_child_bot_model",
      "set_child_instructions",
      "shell",
      "skill_read",
      "spawn_bot",
      "update_bot",
      "update_group",
      "update_preferences",
      "use_tool",
      "web_fetch",
      "web_search",
      "write_file",
    ]);
    // Core team schemas add less than 8 KiB; keep the large routine schema deferred.
    expect(definitionBytes(listed)).toBeLessThanOrEqual(40_000);
    expect(deferred.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["render_plot", "create_space", "generate_secret", "scratchpad_add"]),
    );
  });

  it("names only real built-ins as core", () => {
    for (const name of CORE_BUILTIN_TOOL_NAMES) expect(BUILTIN_AGENT_TOOL_NAMES).toContain(name);
  });

  it("lists every tool when none is deferred", () => {
    const core = ownerChat.filter((tool) => CORE_BUILTIN_TOOL_NAMES.has(tool.name));
    expect(partitionTools(core)).toEqual({ listed: core, deferred: [] });
  });

  it("names deferred tools by area in find_tool, without schemas", () => {
    const { listed, deferred } = partitionTools(ownerChat);
    const description = listed.find((tool) => tool.name === FIND_TOOL)!.description;
    for (const tool of deferred) expect(description).toContain(tool.name);
    expect(description).toContain("secrets:\n");
    expect(description).not.toContain("inputSchema");
    expect(listed.some((tool) => tool.name === USE_TOOL)).toBe(true);
  });

  it("finds exact names and ranks a query over names, descriptions and parameters", () => {
    const { deferred } = partitionTools(ownerChat);
    const plot = findTools(deferred, { names: ["render_plot", "shell", "nope"] });
    expect(plot.tools.map((tool) => tool.name)).toEqual(["render_plot"]);
    expect(plot.tools[0]!.inputSchema).toEqual(
      deferred.find((tool) => tool.name === "render_plot")!.inputSchema,
    );
    expect(plot.unknown).toEqual(["shell", "nope"]);

    const names = (query: string) => findTools(deferred, { query }).tools.map((tool) => tool.name);
    expect(names("chart")).toContain("render_plot");
    expect(names("new space")[0]).toBe("create_space");
    expect(names("generate password")[0]).toBe("generate_secret");
    expect(names("scratchpad add")[0]).toBe("scratchpad_add");
    expect(names("scratchpad").length).toBe(3);
    expect(findTools(deferred, { query: "zzzz" })).toMatchObject({
      tools: [],
      hint: expect.any(String),
    });
  });

  it("never finds a tool the bot turned off", () => {
    const { listed, deferred } = partitionTools(
      selectBuiltinToolsForRun({
        graphicalToolsAllowed: false,
        groupId: null,
        trigger: "user",
        semanticMemoryEnabled: false,
        messagingChannelRun: false,
        disabledBuiltinTools: ["render_plot"],
      }),
    );
    expect(findTools(deferred, { names: ["render_plot"] })).toMatchObject({
      tools: [],
      unknown: ["render_plot"],
    });
    expect(listed.find((tool) => tool.name === FIND_TOOL)!.description).not.toContain(
      "render_plot",
    );
  });

  it("does not grant fleet access or a disabled peer tool by making their schemas core", () => {
    const granted = selectBuiltinToolsForRun({
      graphicalToolsAllowed: false,
      groupId: null,
      trigger: "user",
      semanticMemoryEnabled: false,
      messagingChannelRun: false,
      fleetManagement: false,
      disabledBuiltinTools: ["message_bot", "archive_bot"],
    });
    const { listed, deferred } = partitionTools(granted);
    expect(listed.some((tool) => tool.name === "message_bot" || tool.name === "list_fleet")).toBe(
      false,
    );
    expect(listed.some((tool) => tool.name === "archive_bot")).toBe(false);
    expect(
      findTools(deferred, { names: ["message_bot", "list_fleet", "archive_bot"] }).tools,
    ).toEqual([]);
  });

  it("shows the real tool as activity", () => {
    expect(
      describeToolActivity(USE_TOOL, { name: "create_space", arguments: { name: "Finance" } }),
    ).toBe("Creating space: Finance");
  });
});
