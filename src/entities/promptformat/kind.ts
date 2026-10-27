/** The prompt format kind: turn markers for text-completion connections (kept whole; nothing reads it yet). */
import { defineKind } from "../_shared/kind-descriptor";
import type { PromptFormatBody } from "./schema";

export default defineKind<"promptformat", PromptFormatBody>({
  id: "promptformat", order: 80, singular: "Prompt format", plural: "Prompt formats", short: "fmt", receiptWord: "prompt format",
  blurb: "Turn markers for text completion", icon: "lucide:file-code", accent: "var(--deck-preset)", libraryDeck: true,
  describe: (b) => [
    `name     ${b.name || "(unnamed)"}`,
    `parts    ${[b.instruct && "instruct", b.context && "context"].filter(Boolean).join(", ") || "(none)"}`,
  ],
});
