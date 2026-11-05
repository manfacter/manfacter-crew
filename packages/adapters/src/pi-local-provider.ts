import type { Model, MutableModels, Provider, ProviderStreams } from "@earendil-works/pi-ai";
import { createProvider } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { Agent } from "undici";

import { declaredVisionModelIds, inputModalities } from "./model-modalities.js";
import { LOCAL_PROVIDER_ID, localModelIds } from "./pi-local-provider-id.js";
import { closeDispatcherWithResponse, requestInitFor } from "./pi-openai-compatible-provider.js";
import {
  modelConnectTimeoutMs,
  modelStreamIdleTimeoutMs,
  modelStreamTimeoutMs,
} from "./pi-runtime-limits.js";
import { dispatcherFetch, fetchPairedWithDispatcher } from "./undici-fetch.js";

/**
 * Local OpenAI-compatible model server (Ollama, LM Studio, llama.cpp, MLX).
 * The server is keyless, but `resolve` returns a placeholder because Models
 * hides providers with no resolvable auth.
 */
export { LOCAL_PROVIDER_ID };

/** Tool-call JSON may be buffered until complete, beyond Node's default five-minute wait. */
export function createLocalModelFetch(
  baseFetch: typeof globalThis.fetch = dispatcherFetch,
): typeof globalThis.fetch {
  return async (input, init) => {
    const dispatcher = new Agent({
      connect: { timeout: modelConnectTimeoutMs() },
      headersTimeout: modelStreamTimeoutMs(LOCAL_PROVIDER_ID),
      bodyTimeout: modelStreamIdleTimeoutMs(LOCAL_PROVIDER_ID),
    });
    try {
      const response = await fetchPairedWithDispatcher(baseFetch)(
        input instanceof Request ? input.url : input,
        {
          ...(await requestInitFor(input, init)),
          dispatcher,
        } as RequestInit & { dispatcher: Agent },
      );
      return await closeDispatcherWithResponse(response, dispatcher);
    } catch (error) {
      await dispatcher.destroy().catch(() => undefined);
      throw error;
    }
  };
}

/** Model ids the local server serves with vision, declared by the operator. */
export const LOCAL_VISION_MODELS_ENV = "RAKAZO_LOCAL_VISION_MODELS";

export function localVisionModelIds(): ReadonlySet<string> {
  return declaredVisionModelIds(LOCAL_VISION_MODELS_ENV);
}

/** Model ids the local server serves with OpenAI-style `reasoning_effort`, declared by the operator. */
export const LOCAL_REASONING_MODELS_ENV = "RAKAZO_LOCAL_REASONING_MODELS";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434/v1";
const DEFAULT_CONTEXT_WINDOW = 32_768;
const DEFAULT_MAX_TOKENS = 4_096;

export function localBaseUrl(): string {
  const value = process.env.RAKAZO_LOCAL_MODELS_URL?.trim() || DEFAULT_BASE_URL;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("RAKAZO_LOCAL_MODELS_URL must be an absolute HTTP(S) URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("RAKAZO_LOCAL_MODELS_URL must be an absolute HTTP(S) URL");
  }
  return value;
}

/** Throws instead of `Number(x) || default`, which would swallow a typo or accept a negative window. */
function tokenLimit(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, received "${raw}"`);
  }
  return value;
}

function localModel(id: string): Model<"openai-completions"> {
  // Same comma-separated id list as the vision opt-in.
  const reasoning = declaredVisionModelIds(LOCAL_REASONING_MODELS_ENV).has(id);
  return {
    id,
    name: id,
    api: "openai-completions",
    provider: LOCAL_PROVIDER_ID,
    baseUrl: localBaseUrl(),
    reasoning,
    compat: reasoning
      ? { supportsDeveloperRole: false, supportsReasoningEffort: true, thinkingFormat: "openai" }
      : { supportsDeveloperRole: false, supportsReasoningEffort: false },
    // Mirrors openAiCompatibleModel's reasoning levels.
    ...(reasoning ? { thinkingLevelMap: { off: "none", xhigh: "xhigh", max: "max" } } : {}),
    input: inputModalities(localVisionModelIds().has(id)),
    // Runs on the operator's own hardware, so there is nothing to bill.
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: tokenLimit("RAKAZO_LOCAL_CONTEXT_WINDOW", DEFAULT_CONTEXT_WINDOW),
    maxTokens: tokenLimit("RAKAZO_LOCAL_MAX_TOKENS", DEFAULT_MAX_TOKENS),
  };
}

export function localProvider(): Provider | undefined {
  const ids = localModelIds();
  if (!ids.length) return undefined;
  const api = openAICompletionsApi();
  const streams: ProviderStreams = {
    stream: (model, context, options) =>
      api.stream(model, context, {
        ...options,
        fetch: createLocalModelFetch(options?.fetch),
      }),
    streamSimple: (model, context, options) =>
      api.streamSimple(model, context, {
        ...options,
        fetch: createLocalModelFetch(options?.fetch),
      }),
  };
  return createProvider({
    id: LOCAL_PROVIDER_ID,
    name: "Local (Ollama / LM Studio)",
    baseUrl: localBaseUrl(),
    auth: {
      apiKey: {
        name: "Local model server",
        resolve: async () => ({
          auth: { apiKey: "local", baseUrl: localBaseUrl() },
          source: "local model server",
        }),
      },
    },
    models: ids.map(localModel),
    api: streams,
  });
}

export function registerLocalProvider(models: MutableModels): MutableModels {
  const provider = localProvider();
  if (provider) models.setProvider(provider);
  return models;
}
