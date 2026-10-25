/**
 * A scene's roster from what the page holds: the frozen cast (the card's name and colours, the persona's name) and the stored
 * participants. The card's colours are its authored gradient or signature, else the art accent (the one resolver the Cast wing and
 * the scene accents use, studio/summary.ts). Pure.
 */
import { bodyOf, recOr, str } from "../../../../core/guards";
import { buildRoster, type Roster } from "../../../../core/participants/roster";
import type { ChatParticipants } from "../../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../../studio/scenes";
import { authoredColors } from "../../../../studio/summary";

export function sceneRoster(scene: OpenScene, stored: ChatParticipants | undefined): Roster {
  const { chat, snapshot } = scene;
  const card = snapshot.character;
  const authored = authoredColors(card);
  const accent = chat.cast.character.accent;
  const persona = snapshot.persona ? str(bodyOf(snapshot.persona)["name"]).trim() : "";
  return buildRoster({
    chatId: chat.id,
    card: { id: chat.cast.character.id, name: str(recOr(bodyOf(card)["identity"])["name"]).trim() || chat.cast.character.name || "Character", colors: authored.length > 0 ? authored : accent ? [accent] : [] },
    persona: persona ? { name: persona } : undefined,
    stored,
  });
}
