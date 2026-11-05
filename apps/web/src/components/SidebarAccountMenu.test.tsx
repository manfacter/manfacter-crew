// @vitest-environment jsdom
import type { DesktopUpdateState } from "@rakazo/contracts";
import { Toaster } from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DesktopUpdatesProvider } from "./DesktopUpdates";
import { SidebarAccountMenu } from "./SidebarAccountMenu";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((text, part, index) => text + part + (values[index] ?? ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  delete window.rakazoDesktop;
  vi.restoreAllMocks();
});
async function render(
  name = "Demo User",
  onIntegrations = vi.fn(),
  onBoard?: () => void,
  logos?: Array<{ name: string; logo?: string }>,
) {
  const email = "account@rakazo.test";
  await act(async () =>
    root.render(
      <DesktopUpdatesProvider>
        <SidebarAccountMenu
          logos={logos}
          name={name}
          email={email}
          open
          onOpenChange={() => {}}
          onIntegrations={onIntegrations}
          onSkills={vi.fn()}
          onBoard={onBoard}
          onArtifacts={() => {}}
          onSettings={() => {}}
          onLogOut={() => {}}
          signingOut={false}
          logOutError={null}
        />
        <Toaster />
      </DesktopUpdatesProvider>,
    ),
  );
}
function bridge(phase: DesktopUpdateState["phase"]) {
  const state: DesktopUpdateState = {
    phase,
    currentVersion: "0.1.0",
    availableVersion: "0.2.0",
    percent: null,
    message: null,
    checkedAt: null,
  };
  const install = vi.fn(async () => state);
  window.rakazoDesktop = {
    platform: "darwin",
    window: {
      close: async () => {},
      minimize: async () => {},
      toggleMaximize: async () => {},
      state: async () => ({ minimized: false, maximized: false, fullScreen: false }),
    },
    oauth: { onCallback: () => () => {} },
    update: {
      state: async () => state,
      install,
      download: async () => state,
      check: async () => state,
    },
  };
  return install;
}
it("hides update controls without a desktop bridge", async () => {
  await render();
  expect(document.querySelector('[aria-label="Install update"]')).toBeNull();
  expect(document.body.textContent).not.toContain("New update available");
});
it.each(["unsupported", "idle", "available", "downloading", "checking", "error"] as const)(
  "hides install controls in phase %s",
  async (phase) => {
    bridge(phase);
    await render();
    expect(document.querySelector('[aria-label="Install update"]')).toBeNull();
    expect(document.body.textContent).not.toContain("New update available");
  },
);
it("installs the ready update only through the footer button", async () => {
  const install = bridge("ready");
  await render("Ada Lovelace");
  const icon = document.querySelector<HTMLButtonElement>('[aria-label="Install update"]')!;
  expect(icon).not.toBeNull();
  expect(document.body.textContent).not.toContain("New update available");
  await act(async () => icon.click());
  expect(install).toHaveBeenCalledTimes(1);
  expect(
    [...document.querySelectorAll("button")].some((button) => button.textContent === "Install"),
  ).toBe(false);
});
it("uses a settings icon for the account menu instead of an avatar", async () => {
  await render("Ada Lovelace");
  const trigger = host.querySelector('[data-testid="user-menu-trigger"]')!;
  expect(trigger.querySelector("img")).toBeNull();
  expect(trigger.querySelector(".lucide-settings")).not.toBeNull();
  expect(trigger.textContent).toBe("");
});

it("opens integrations and keeps the existing account actions and links", async () => {
  const onIntegrations = vi.fn();
  await render("Demo User", onIntegrations, vi.fn());
  const menu = document.querySelector('[data-slot="popover-content"]')!;
  const connect = [...menu.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Connect apps"),
  )!;
  await act(async () => connect.click());
  expect(onIntegrations).toHaveBeenCalledOnce();
  expect(connect.querySelector(".lucide-plug")).not.toBeNull();
  expect(host.textContent).not.toContain("Connect apps");
  expect([...menu.querySelectorAll("button, a")].map((row) => row.textContent)).toEqual([
    "Connect apps",
    "Settings",
    "Skills",
    "Artifacts",
    "Board",
    "Docs",
    "Log out",
  ]);
  expect(host.querySelector('[data-testid="user-menu-trigger"]')?.getAttribute("aria-label")).toBe(
    "Account menu for Demo User",
  );
});
it("omits Board when unavailable", async () => {
  await render();
  expect(document.querySelector('[data-slot="popover-content"]')?.textContent).not.toContain(
    "Board",
  );
});

it("links to the maintained fork documentation without advertising an upstream app", async () => {
  await render();
  const docs = [...document.querySelectorAll("a")].find((link) => link.textContent === "Docs")!;
  expect(docs.href).toBe(
    "https://github.com/manfacter/manfacter-crew/blob/codex/admin-embed/docs/admin-embed.md",
  );
  expect(
    document.querySelector('a[href*="apps.apple.com"], a[href*="play.google.com"]'),
  ).toBeNull();
});
it("falls back when app artwork fails and accepts replacement artwork", async () => {
  await render("Demo User", undefined, undefined, [
    { name: "Slack", logo: "https://example.test/slack.svg" },
  ]);
  const pill = [...document.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Connect apps"),
  )!;
  await act(async () => pill.querySelector("img")!.dispatchEvent(new Event("error")));
  expect(pill.querySelector("img")).toBeNull();
  expect(pill.textContent).toContain("S");
  await render("Demo User", undefined, undefined, [
    { name: "Slack", logo: "https://example.test/new-slack.svg" },
  ]);
  expect(pill.querySelector("img")?.src).toBe("https://example.test/new-slack.svg");
});
it.each(["throw", "state"] as const)(
  "reveals a %s install failure after Later",
  async (failure) => {
    const install = bridge("ready");
    if (failure === "throw") install.mockRejectedValueOnce(new Error("offline"));
    else
      install.mockResolvedValueOnce({
        ...(await window.rakazoDesktop!.update.state()),
        phase: "error",
        message: "Update could not be installed",
      });
    await render();
    // The notice is a toast, which mounts and leaves on the toaster's own timers.
    const notice = () => document.querySelector('[aria-label="Desktop update"]');
    const later = () =>
      [...notice()!.querySelectorAll("button")].find((button) => button.textContent === "Later")!;
    await vi.waitFor(() => expect(notice()).not.toBeNull());
    await act(async () => later().click());
    await vi.waitFor(() => expect(notice()).toBeNull());
    await act(async () =>
      document.querySelector<HTMLButtonElement>('[aria-label="Install update"]')!.click(),
    );
    await vi.waitFor(() =>
      expect(notice()?.querySelector('[role="status"]')?.textContent).toBe(
        failure === "throw"
          ? "Could not complete the update. Try again."
          : "Update could not be installed",
      ),
    );
    await act(async () => later().click());
    await vi.waitFor(() => expect(notice()).toBeNull());
  },
);

it("keeps at most three marks with the same tile and a missing-logo fallback", async () => {
  await render("Demo User", undefined, undefined, [
    { name: "Gmail", logo: "https://example.test/gmail.svg" },
    { name: "Notion" },
    { name: "GitHub", logo: "https://example.test/github.svg" },
    { name: "Slack" },
  ]);
  const tiles = [
    ...document.querySelectorAll('[data-slot="popover-content"] span[aria-hidden="true"] > span'),
  ];
  expect(tiles).toHaveLength(3);
  expect(new Set(tiles.map((tile) => tile.className)).size).toBe(1);
  expect(tiles[1]!.textContent).toBe("N");
});

const personal = {
  id: "org-personal",
  name: "Personal",
  defaultSpaceId: "s1",
  spaceIds: ["s1"],
  canManage: true,
};
const work = {
  id: "org-work",
  name: "Work",
  defaultSpaceId: "s2",
  spaceIds: ["s2"],
  canManage: true,
};

async function renderOrganizations(
  organizations: (typeof personal)[],
  onSwitchOrganization = vi.fn(),
) {
  await act(async () =>
    root.render(
      <DesktopUpdatesProvider>
        <SidebarAccountMenu
          name="Demo User"
          email="account@rakazo.test"
          open
          onOpenChange={() => {}}
          onIntegrations={() => {}}
          onSkills={() => {}}
          onArtifacts={() => {}}
          onSettings={() => {}}
          onLogOut={() => {}}
          signingOut={false}
          logOutError={null}
          organizations={organizations}
          activeOrganizationId="org-personal"
          onSwitchOrganization={onSwitchOrganization}
        />
      </DesktopUpdatesProvider>,
    ),
  );
  return [...document.querySelector('[data-slot="popover-content"]')!.querySelectorAll("button")];
}

it("shows no organization rows with one organization", async () => {
  const rows = await renderOrganizations([personal]);
  expect(rows[0]!.textContent).toBe("Connect apps");
});

it("lists two organizations with the active one checked", async () => {
  const onSwitch = vi.fn();
  const rows = await renderOrganizations([personal, work], onSwitch);
  expect(rows.map((row) => row.textContent).slice(0, 3)).toEqual([
    "Personal",
    "Work",
    "Connect apps",
  ]);
  expect(rows[0]!.getAttribute("aria-current")).toBe("true");
  expect(rows[0]!.querySelector("svg")).not.toBeNull();
  expect(rows[1]!.hasAttribute("aria-current")).toBe(false);
  expect(rows[1]!.querySelector("svg")).toBeNull();
  await act(async () => rows[1]!.click());
  expect(onSwitch).toHaveBeenCalledWith(work);
});
