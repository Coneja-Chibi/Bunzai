/** Agent pieces are reusable model personalities with their own linked tools and skills. */
import { defineKind } from "../_shared/kind-descriptor";
import { emptyAgentBody, type AgentBody } from "./schema";
export default defineKind<"agent", AgentBody>({
  id: "agent", order: 81, singular: "Agent", plural: "Agents", short: "agt", receiptWord: "agent",
  blurb: "Who runs a phase", icon: "lucide:sparkles", accent: "var(--deck-preset)", libraryDeck: true,
  blank: () => emptyAgentBody("My Agent"), blankId: "agent", editor: { id: "agent", label: "Agent editor", load: "light" },
  links: [{ field: "tools", to: "tool", label: "Tools" }, { field: "skills", to: "skill", label: "Skills" }],
  describe: (body) => [`name     ${body.name}`, `tools    ${body.tools.length}`, `skills   ${body.skills.length}`],
});
