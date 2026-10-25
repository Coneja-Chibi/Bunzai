/** The Generate prompt each simple tracker sends is RoleCall's: its opening line and the shape of the JSON it asks for. */
import { expect, test } from "bun:test";
import { BONDS_GEN } from "./bonds";
import { CORRUPTION_GEN } from "./corruption";
import { EVENTS_GEN } from "./events";
import { itemMessages } from "./generate";
import { PARTY_GEN } from "./party";

const ROWS = [
  ["bonds", BONDS_GEN, "Vera", "You are generating a Supernatural or mystical bond/connection. Pick the most fitting bondType;", '"bondType": "sire_childe" | "blood_bound" | "pack_member"'],
  ["corruption", CORRUPTION_GEN, "Sera", "You are generating a NPC corruption entry for a roleplay game.", '"identityLoss": number,\n  "cause": string,\n  "effects": [string],\n  "description": string'],
  ["events", EVENTS_GEN, "Siege", "You are generating a Parallel event entry with story ledger categorization for a roleplay game.", '"plotCategory": "immediate" | "looming" | "completed",'],
  ["party", PARTY_GEN, "Brann", "You are generating a Party member entry for a roleplay game.", '"combatRole": "tank" | "dps" | "healer" | "support",\n  "formationPosition": "front" | "mid" | "back",'],
] as const;

test.each(ROWS)("the %s generate prompt is RoleCall's", (_name, gen, itemName, opening, shape) => {
  const m = itemMessages(gen, { action: "generate", itemName, characterName: "Vera", personaName: "Mira", transcript: [], subs: {} });
  expect(m.user).toContain(opening);
  expect(m.user).toContain(shape);
});
