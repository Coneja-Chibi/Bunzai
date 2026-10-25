/**
 * Reasoning continuity (RoleCall's roundtrip_native_reasoning, prompt-assembly.ts 3338-3375): an earlier reply's provider
 * reasoning rides back on that reply in the next request. Only when the scene asks for it, only to the connection and
 * model that wrote it (a signed block sent to another model is refused or corrupts the turn), and only over Anthropic,
 * the one dialect whose request builder sends it as signed `thinking` blocks. RoleCall's own scaffolding for OpenAI
 * reasoning items and OpenRouter details is not wired there either, so none is sent here.
 */
import type { AssembledMessage, HistoryMessage, TraceBlock } from "../core/assembly/types";
import type { ProviderCompletion, ProviderMessage } from "../stage/contracts/provider";

/** The signature of the one thinking block a reply carried, or undefined (several blocks, a redacted one, or none cannot be sent back as one). */
export function thinkingSignature(details: ProviderCompletion["reasoning_details"]): string | undefined {
  const blocks = details ?? [];
  const thinking = blocks.filter((b) => b.type === "thinking");
  const sig = thinking[0]?.["signature"];
  return thinking.length === 1 && blocks.length === 1 && typeof sig === "string" && sig ? sig : undefined;
}

/** The messages with each earlier reply's signed reasoning attached, when continuity applies. */
export function withContinuity<T extends AssembledMessage>(
  messages: readonly T[],
  trace: readonly TraceBlock[],
  history: readonly HistoryMessage[],
  scene: { on: boolean; kind: string; connectionId: string; model: string },
): (T & Pick<ProviderMessage, "reasoning">)[] {
  if (!scene.on || scene.kind !== "anthropic") return [...messages];
  const byId = new Map(history.map((m) => [m.id, m]));
  return messages.map((m, i) => {
    const source = trace[i]?.source;
    const r = m.role === "assistant" && source?.kind === "history" ? byId.get(source.messageId)?.reasoning : undefined;
    return r?.signature && r.model === scene.model && r.provider === scene.connectionId ? { ...m, reasoning: { text: r.text, signature: r.signature, provider: "anthropic" } } : m;
  });
}
