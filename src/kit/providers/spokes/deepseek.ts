/** DeepSeek: OpenAI-compatible endpoint at a fixed base. */
import type { ProviderSpoke } from "../spoke";
import { openAICompatModels } from "../models";
import { stopList } from "../../../stage/params/dialects";

const deepseek: ProviderSpoke = {
  id: "deepseek",
  label: "DeepSeek",
  brand: "#4D6BFE",
  host: "api.deepseek.com",
  defaultModel: "deepseek-chat",
  async model({ apiKey, baseURL, headers, model }, fetch) {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    return createOpenAICompatible({
      name: "deepseek",
      baseURL: baseURL ?? "https://api.deepseek.com/v1",
      apiKey,
      headers,
      fetch,
    })(model);
  },
  async listModels({ apiKey, baseURL }, fetch) {
    return openAICompatModels(baseURL ?? "https://api.deepseek.com/v1", apiKey, fetch);
  },
  // api-docs.deepseek.com create-chat-completion: frequency and presence penalty are deprecated with no effect; stop takes 16.
  scene: { params: { logprobs: true, top_logprobs: true, response_format: true, stop: stopList("stop", 16) }, base: (c) => c.baseURL ?? "https://api.deepseek.com/v1", support: { streamUsage: true } },
};

export default deepseek;
