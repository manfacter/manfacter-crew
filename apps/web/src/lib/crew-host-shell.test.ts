import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

it("repeats readiness for a trusted host after a missed initial announcement", async () => {
  const source = readFileSync(
    new URL("../../public/crew-host-shell.js", import.meta.url),
    "utf8",
  );
  const parent = { postMessage: vi.fn() };
  let receive: (event: unknown) => Promise<void> = async () => {};
  await runInNewContext(`(async () => { ${source} })()`, {
    window: {
      parent,
      addEventListener: (_: string, listener: typeof receive) => {
        receive = listener;
      },
    },
    document: { getElementById: () => ({}) },
    fetch: async () => ({
      ok: true,
      json: async () => ({ origin: "http://localhost:3000" }),
    }),
    setInterval: () => {},
  });
  expect(parent.postMessage).toHaveBeenCalledTimes(1);
  await receive({
    source: parent,
    origin: "https://untrusted.example",
    data: { type: "crew:hello" },
  });
  await receive({
    source: {},
    origin: "http://localhost:3000",
    data: { type: "crew:hello" },
  });
  expect(parent.postMessage).toHaveBeenCalledTimes(1);
  await receive({
    source: parent,
    origin: "http://localhost:3000",
    data: { type: "crew:hello" },
  });
  expect(parent.postMessage).toHaveBeenCalledTimes(2);
  expect(parent.postMessage).toHaveBeenLastCalledWith(
    { type: "crew:ready" },
    "http://localhost:3000",
  );
});

it("closes only its own frame and reloads a replaced session without resetting ordinary renewals", async () => {
  const source = readFileSync(new URL("../../public/crew-host-shell.js", import.meta.url), "utf8");
  const parent = { postMessage: vi.fn() };
  let receive: (event: unknown) => Promise<void> = async () => {};
  let tick = () => {};
  let navigations = 0;
  let src: string | undefined;
  let sessionId = "first-session";
  const expiresAt = new Date(Date.now() + 75000).toISOString();
  const frame = {
    hidden: true,
    hasAttribute: () => src !== undefined,
    removeAttribute: () => { src = undefined; },
    set src(value: string) { src = value; navigations++; },
  };
  const status = { hidden: false, textContent: "" };
  const fetch = vi.fn(async (path: string) => ({
    ok: true,
    json: async () => path.endsWith("config") ? { origin: "https://admin.example.com" }
      : { expiresAt, sessionId },
  }));
  await runInNewContext(`(async () => { ${source} })()`, {
    window: { parent, addEventListener: (_: string, listener: typeof receive) => { receive = listener; } },
    document: { getElementById: (id: string) => id === "crew" ? frame : status },
    fetch, Date, setInterval: (callback: () => void) => { tick = callback; },
  });
  const send = (type: string) => receive({ source: parent, origin: "https://admin.example.com", data: { type, assertion: "synthetic" } });
  await send("crew:session");
  await send("crew:session");
  expect(navigations).toBe(1);
  sessionId = "replacement-session";
  await send("crew:session");
  expect(navigations).toBe(2);
  await send("crew:close");
  expect(frame.hidden).toBe(true);
  expect(src).toBeUndefined();
  await send("crew:session");
  const now = vi.spyOn(Date, "now").mockReturnValue(Date.parse(expiresAt) + 1);
  try { tick(); } finally { now.mockRestore(); }
  expect(frame.hidden).toBe(true);
  expect(src).toBeUndefined();
  expect(fetch.mock.calls.some(([path]) => path.endsWith("sign-out"))).toBe(false);
});
