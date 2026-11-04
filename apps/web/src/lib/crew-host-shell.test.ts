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
