/**
 * The scene scope's World page (wireframe SCOPES.scene, filed by where each value is stored: lorebook choice, Compendium access and the roster are this scene's). Every row is bound to the
 * writer the Full Chat wing uses: the lorebook switches to `useSceneLore` (use-scene-lore.ts), a book's Compendium access to `useSceneCompendium` through `accessChange` (compendium-books.tsx), a participant's
 * presence to `useSceneParticipants`. The tools themselves (entries, the Compendium's tabs, colors, Reconcile) are drill rows to their Messenger programs.
 */
import { useEffect, type JSX } from "react";
import { sceneRoster } from "../../../participants/scene-roster";
import { useSceneParticipants } from "../../../participants/use-scene-participants";
import { useSceneLore } from "../../../use-scene-lore";
import { ActionRow, DrillRow, SelectRow, ToggleRow } from "../../frames/settings-rows";
import type { SettingsCategory } from "../../frames/settings-window";
import type { WingArgs } from "../../wing-props";
import type { OpenProgram } from "../scopes";
import { BookAccessRows } from "./compendium-books";

const SAY = "msn-st-secd";

/** One switch per lorebook the scene reads, plus the way to the Lorebooks program. The Control Booth page shows the same rows. */
export function LorebookRows({ a, open }: { a: WingArgs; open: OpenProgram }): JSX.Element {
  const { lore, reload, toggle } = useSceneLore(a.ctx, a.scene.chat.id);
  const { setLoreBooks } = a;
  useEffect(() => { if (lore.state === "ready") setLoreBooks(lore.books); }, [lore, setLoreBooks]);
  return (
    <>
      {lore.state === "loading" && <p className={SAY} role="status">Loading...</p>}
      {lore.state === "failed" && <ActionRow label="Could not read the lorebooks" description={lore.why} action="Try again" onAction={() => void reload()} />}
      {lore.state === "ready" && lore.books.length === 0 && <p className={SAY}>No lorebooks are attached to this scene.</p>}
      {lore.state === "ready" && lore.books.map((b) => (
        <ToggleRow key={b.id} label={b.name} description={b.missing ? "Not in your library" : `${b.tokens.toLocaleString()} tokens, ${b.entries.toLocaleString()} entries`} on={b.enabled} onChange={() => toggle(b)} />
      ))}
      <DrillRow label="Lorebooks" description="Entries, attaching and creating books." value={lore.state === "ready" ? `${lore.books.length} attached` : undefined} onOpen={() => open("lorebook")} />
    </>
  );
}

/** One access choice per book, as in the Compendium's access chip, and the way to the Compendium. */
export function CompendiumRows({ a, open }: { a: WingArgs; open: OpenProgram }): JSX.Element {
  return (
    <>
      <BookAccessRows a={a} />
      <DrillRow label="Compendium" description="Browse, file and tune filed world notes. Every Compendium setting is on the Compendium page." onOpen={() => open("compendium")} />
    </>
  );
}

const PRESENCE = [{ value: "present", label: "Present" }, { value: "background", label: "Background" }, { value: "absent", label: "Absent" }] as const;

/** One presence choice per participant, as the Participants tab's Scene select, and the way to the Participants program. */
export function ParticipantRows({ a, open }: { a: WingArgs; open: OpenProgram }): JSX.Element {
  const { stored, loaded, error, change } = useSceneParticipants(a.ctx, a.scene.chat.id);
  const roster = loaded ? sceneRoster(a.scene, stored) : null;
  const people = roster ? [roster.main, ...(roster.player ? [roster.player] : []), ...roster.cards, ...roster.npcs] : [];
  return (
    <>
      {!loaded && !error && <p className={SAY} role="status">Loading...</p>}
      {error && <p className={SAY} role="alert">{error}</p>}
      {people.map((p) => (
        <SelectRow key={p.id} label={p.name} description={p.main ? "Main character" : p.kind === "npc" ? "NPC" : p.kind === "player" ? "Player" : "Card"} value={p.presence} options={PRESENCE}
          onChange={(presence) => change({ op: "edit", id: p.id, edit: { presence } })} />
      ))}
      <DrillRow label="Participants" description="Colors, names, Set Main and Reconcile." value={roster ? `${people.length} in this scene` : undefined} onOpen={() => open("participants")} />
    </>
  );
}

export function worldCategory(a: WingArgs, open: OpenProgram): SettingsCategory {
  // clone-ok: a settings category is a table of sections, the same shape as every other category by design
  return { id: "world", label: "World", icon: "lucide:book-open", group: "Scene cast", sections: [
    { id: "lorebooks", title: "Lorebooks", description: "World knowledge, switched on or off for this scene.", body: <LorebookRows a={a} open={open} /> },
    { id: "compendium", title: "Compendium", description: "How the AI may use each book's filed notes.", body: <CompendiumRows a={a} open={open} /> },
    { id: "participants", title: "Participants", description: "Who is in this scene, and whether they are on stage.", body: <ParticipantRows a={a} open={open} /> },
  ] };
}
