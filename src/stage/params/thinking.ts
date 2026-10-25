/**
 * The two thinking switches that are not samplers (RoleCall's keep_inline_thinking_tags and roundtrip_native_reasoning,
 * lib/ai/samplers/definitions.ts:667 and :677), here the scene's own settings (ChatStore rule 37 `keepThinking` and
 * `continuity`). Copy is RoleCall's, trimmed to what a scene does.
 */
import type { ParamDef } from "./types";

export const THINKING_PARAMS: readonly ParamDef[] = [
  {
    id: "keep_inline_thinking_tags", label: "Let the model see its old thinking", group: "thinking", kind: "boolean", default: false,
    description: "Off: thinking caught into Behind the Scene is removed from the chat history the model reads next turn. On: the model sees it. This never changes what gets caught; that is Catch thinking. Provider reasoning is separate and follows Reasoning continuity.",
  },
  {
    id: "roundtrip_native_reasoning", label: "Round-trip Native Reasoning", group: "thinking", kind: "boolean", default: false,
    description: "When enabled, the signed thinking blocks of earlier replies are sent back to the model that wrote them, while Reasoning Effort has thinking on. Only Anthropic connections take them; every other connection is never sent them, and so is a different model than the one that wrote the reply.",
    notes: "Needed for signed Claude thinking to carry across turns. Costs the earlier thinking's tokens on every request.",
  },
];
