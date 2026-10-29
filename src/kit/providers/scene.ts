/**
 * The provider a scene sends through (items 8 and 9): a saved Kit
 * connection, turned into the stage's OpenAI-compatible provider. It goes through the same readiness
 * check and the same egress gate as Kit's own turns, so a scene can reach only the one host its
 * connection names. A connection whose spoke declares no scene endpoint (Kit's subscription
 * sign-ins) is refused with the reason the AI wing shows.
 */
import { createOpenAICompatibleProvider } from "../../stage/provider/openai-compatible";
import { createAnthropicProvider } from "../../stage/provider/anthropic";
import type { Provider } from "../../stage/contracts/provider";
import type { ProviderConfig } from "./config";
import { allowedHost, assertReady, EgressBlocked, guardedFetch } from "./egress";
import { spokes } from "./registry";
import type { ProviderSpoke } from "./spoke";

/** Why a scene cannot send through this spoke, or null when it can. */
export function sceneRefusal(spoke: ProviderSpoke | undefined): string | null {
  if (!spoke) return "this build has no provider of that type";
  if (!spoke.scene) {
    return spoke.chat
      ? `Kit's ${spoke.label} sign-in drives Kit's own agent; scenes can't send through it yet. Use a connection with an API key.`
      : `${spoke.label} can't be used by scenes yet.`;
  }
  return null;
}

/** Models that refuse tool calls whatever their host says. */
const NO_TOOLS = /(^|[/:-])(o1-mini|o1-preview|text-embedding|whisper|tts|dall-e|gpt-image)/i;

/** Whether a scene sends tools to this model: its spoke has a scene endpoint and the model is not one that refuses them. */
export const sceneTools = (spoke: ProviderSpoke | undefined, model: string): boolean => Boolean(spoke?.scene) && !NO_TOOLS.test(model);

export async function sceneProvider(config: ProviderConfig): Promise<Provider> {
  const spoke = (await spokes()).get(config.kind);
  const refusal = sceneRefusal(spoke);
  if (refusal || !spoke?.scene) throw new EgressBlocked(refusal ?? "this connection cannot be used by scenes.");
  assertReady(config, spoke);
  const baseUrl = spoke.scene.base(config);
  if (!baseUrl) throw new EgressBlocked(`${spoke.label} needs a base URL.`);
  // Refused here with a plain reason; the gate would refuse the request anyway, as a failed send.
  const host = allowedHost(config, spoke);
  if (new URL(baseUrl).host !== host) throw new EgressBlocked(`refused to reach ${new URL(baseUrl).host}; this connection only talks to ${host}.`);
  const customHeaders = config.headers && Object.keys(config.headers).length > 0 ? JSON.stringify(config.headers) : undefined;
  if (spoke.scene.native === "anthropic") {
    return createAnthropicProvider(
      { id: config.id ?? config.kind, ...(spoke.scene.params ? { params: spoke.scene.params } : {}), ...(config.baseURL ? { baseUrl: config.baseURL } : {}), ...(config.apiKey ? { apiKey: config.apiKey } : {}), ...(customHeaders ? { customHeaders } : {}) },
      { fetch: guardedFetch(host), label: config.name ?? spoke.label },
    );
  }
  return createOpenAICompatibleProvider(
    {
      id: config.id ?? config.kind,
      baseUrl,
      ...(spoke.scene.params ? { params: spoke.scene.params } : {}),
      ...(config.apiKey ? { apiKey: config.apiKey } : {}),
      ...(customHeaders ? { customHeaders } : {}),
      ...(spoke.scene.support ? { support: spoke.scene.support } : {}),
    },
    { fetch: guardedFetch(host), label: config.name ?? spoke.label },
  );
}
