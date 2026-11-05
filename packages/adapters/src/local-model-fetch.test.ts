import type * as Undici from "undici";
import { afterEach, expect, it, vi } from "vitest";
import { createLocalModelFetch } from "./pi-local-provider.js";

const transport = vi.hoisted(() => ({
  options: [] as unknown[],
  agents: [] as Undici.Agent[],
}));
vi.mock("undici", async (importOriginal) => {
  const original = await importOriginal<typeof Undici>();
  return {
    ...original,
    Agent: class extends original.Agent {
      constructor(options: Undici.Agent.Options) {
        super(options);
        transport.options.push(options);
        transport.agents.push(this);
      }
    },
  };
});
afterEach(() => {
  vi.unstubAllEnvs();
  transport.options.length = 0;
  transport.agents.length = 0;
});

it("uses the local deadlines in the real dispatcher and closes it after consuming a response", async () => {
  vi.stubEnv("MODEL_STREAM_TIMEOUT_MS", "1200000");
  vi.stubEnv("MODEL_STREAM_IDLE_TIMEOUT_MS", "900000");
  const fetch = vi.fn(async () => new Response("synthetic stream"));
  const request = new Request("http://localhost:1234/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const response = await createLocalModelFetch(fetch)(request);
  expect(transport.options[0]).toMatchObject({
    headersTimeout: 1_200_000,
    bodyTimeout: 900_000,
  });
  expect(fetch).toHaveBeenCalledWith(
    request.url,
    expect.objectContaining({
      method: "POST",
      body: expect.any(ArrayBuffer),
      dispatcher: transport.agents[0],
    }),
  );
  expect(await response.text()).toBe("synthetic stream");
  await vi.waitFor(() => expect(transport.agents[0]?.closed).toBe(true));
});

it("destroys the local dispatcher when a request fails", async () => {
  const failure = new Error("synthetic transport failure");
  await expect(
    createLocalModelFetch(async () => {
      throw failure;
    })("http://localhost:1234/v1/models"),
  ).rejects.toBe(failure);
  expect(transport.agents[0]?.destroyed).toBe(true);
});

it("still aborts an in-flight request immediately when its caller cancels", async () => {
  const caller = new AbortController();
  const fetch = vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("synthetic cancellation")), {
          once: true,
        });
      }),
  );
  const pending = createLocalModelFetch(fetch)("http://localhost:1234/v1/chat/completions", {
    signal: caller.signal,
  });
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  caller.abort();
  await expect(pending).rejects.toThrow("synthetic cancellation");
  expect(transport.agents[0]?.destroyed).toBe(true);
});
