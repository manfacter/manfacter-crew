// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MCP_OAUTH_CHANNEL } from "../lib/mcp-oauth-channel";
import { McpOAuthCallbackPage } from "./McpOAuthCallback";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), complete: vi.fn(async () => ({})) }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts.join("") }),
}));
vi.mock("@rakazo/ui-web", () => ({ Button: () => null }));
vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [new URLSearchParams("code=fixture&state=attempt-1")],
}));
vi.mock("../lib/rpc", () => ({ rpc: { mcp: { oauth: { complete: mocks.complete } } } }));

beforeEach(() => {
  vi.clearAllMocks();
  window.name = "";
  sessionStorage.clear();
  vi.spyOn(window, "close").mockImplementation(() => {});
  vi.stubGlobal("BroadcastChannel", class {
    postMessage() {}
    close() {}
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([true, false])("closes only the marked popup after successful authorization (popup=%s)", async (popup) => {
  if (popup) sessionStorage.setItem(MCP_OAUTH_CHANNEL, "attempt-1");
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => root.render(<McpOAuthCallbackPage />));
    expect(mocks.complete).toHaveBeenCalledWith({ sessionId: "attempt-1", code: "fixture", state: "attempt-1" });
    if (popup) {
      expect(window.close).toHaveBeenCalledOnce();
      expect(mocks.navigate).not.toHaveBeenCalled();
    } else {
      expect(window.close).not.toHaveBeenCalled();
      expect(mocks.navigate).toHaveBeenCalledWith("/app?mcp_oauth=connected", { replace: true });
    }
  } finally {
    await act(async () => root.unmount());
  }
});
