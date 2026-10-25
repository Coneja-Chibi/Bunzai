/** Groq: native, very fast inference. */
import type { ProviderSpoke } from "../spoke";
import { openAICompatModels } from "../models";
import { stopList } from "../../../stage/params/dialects";

const groq: ProviderSpoke = {
  id: "groq",
  label: "Groq",
  brand: "#F55036",
  host: "api.groq.com",
  defaultModel: "llama-3.3-70b-versatile",
  async model({ apiKey, baseURL, headers, model }, fetch) {
    const { createGroq } = await import("@ai-sdk/groq");
    return createGroq({ apiKey, baseURL, headers, fetch })(model);
  },
  async listModels({ apiKey, baseURL }, fetch) {
    return openAICompatModels(baseURL ?? "https://api.groq.com/openai/v1", apiKey, fetch);
  },
  // console.groq.com chat create: penalties, logit_bias and logprobs are unsupported; n must be 1.
  scene: { params: { seed: true, response_format: true, stop: stopList("stop", 4) }, base: (c) => c.baseURL ?? "https://api.groq.com/openai/v1", support: { streamUsage: true }, tools: true },
};

export default groq;
