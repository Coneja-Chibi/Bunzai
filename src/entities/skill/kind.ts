/** The skill kind: instructions the model gets only when they matter, firing like a lore entry (core/skill.ts decides when). */
import { defineKind } from "../_shared/kind-descriptor";
import { emptySkillBody, type SkillBody } from "./schema";

export default defineKind<"skill", SkillBody>({
  id: "skill", order: 79, singular: "Skill", plural: "Skills", short: "skl", receiptWord: "skill",
  blurb: "Instructions for when they matter", icon: "lucide:sparkles", accent: "var(--deck-lorebook)", libraryDeck: true, promptingList: "skills",
  blank: () => emptySkillBody("My skill"), blankId: "skill",
  describe: (b) => [
    `name     ${b.name || "(unnamed)"}`,
    `when     ${b.when}${b.when === "mentioned" ? `: ${b.triggers.map((t) => t.keyword).join(", ") || "(no triggers)"}` : ""}`,
    `text     ${b.text.replace(/\s+/g, " ").slice(0, 80) || "(empty)"}`,
  ],
});
