/**
 * The workshop layer (approved wireframe messenger-discord/panels.html section 6b): a Discord-style settings window over the Messenger for the heavy workspaces. A left nav starts with the
 * scene's avatar and name, then groups its pages under small headers (Prompting, World, Final Cut); the right side is the open page, its title and the program's own body, which is the
 * same editor Full Chat draws. Picking a nav row opens that program in this same layer. The frame is the shell's `Layer` (focus trap, Escape, the close circle); the programs and what they
 * hold are the shell's, so the nav lists only programs the scene has. Scene note opens beside the chat and Control Panel belongs to the settings layer, so neither is a nav page; the
 * wireframe's nav search is not drawn.
 */
import type { JSX, ReactNode } from "react";
import { Ic } from "../../../../../_shared/ic";
import { IconButton, ListRow } from "../../../../../components/button";
import { Layer } from "../../frames/layer";
import type { Program } from "../../programs";
import { ProgramSlot } from "../../shell/program-holders";

const GROUPS: readonly { label: string; ids: readonly string[] }[] = [
  { label: "Prompting", ids: ["prompts", "guides"] },
  { label: "World", ids: ["compendium"] },
  { label: "Final Cut", ids: ["post-production", "regex"] },
];
const HINTS: Readonly<Record<string, string>> = {
  regex: "Text transformations applied to this scene, in order.",
  "post-production": "Rewrites and text cleanup after the narrator writes.",
};

/** Whether a program is a page of the workshop. */
export const isWorkshopProgram = (programId: string): boolean => GROUPS.some((g) => g.ids.includes(programId));

export interface WorkshopScene { name: string; avatar: ReactNode; programs: readonly Program[]; onOpen(programId: string): void }

/** `body` replaces the program's holder (the "is floating" placeholder); `onPopOut` floats the page. */
export function Workshop({ program, holder, scene, onClose, body, onPopOut }: { program: Program; holder: HTMLElement; scene: WorkshopScene; onClose(): void; body?: ReactNode; onPopOut?: () => void }): JSX.Element {
  const hint = HINTS[program.id];
  return (
    <Layer label={program.title} onClose={onClose}>
      <div className="msn-wk" data-part="scene.messenger.workshop">
        <aside className="msn-wk-nav" data-part="scene.messenger.workshop.nav">
          <div className="msn-wk-who">{scene.avatar}<div><b>{scene.name}</b><small>Scene workshop</small></div></div>
          <nav aria-label="Workshop pages">
            {GROUPS.map((g) => {
              const items = g.ids.flatMap((id) => scene.programs.find((p) => p.id === id) ?? []);
              if (items.length === 0) return null;
              return (
                <div key={g.label} className="msn-wk-grp">
                  <div className="msn-wk-cap">{g.label}</div>
                  {items.map(/* bounded-ok: the fixed workshop pages */ (p) => (
                    <ListRow key={p.id} label={p.title} leading={<Ic name={p.icon} size={18} />} selected={p.id === program.id} aria-current={p.id === program.id ? "page" : undefined}
                      onClick={() => scene.onOpen(p.id)} data-part="scene.messenger.workshop.item" />
                  ))}
                </div>
              );
            })}
          </nav>
        </aside>
        <section className="msn-wk-page" aria-label={program.title} data-part="scene.messenger.workshop.page">
          <header className="msn-wk-h"><h2>{program.title}</h2>{hint && <p>{hint}</p>}{onPopOut && <IconButton data-part="scene.messenger.workshop.popout" variant="quiet" size="sm" icon="lucide:external-link" label="Pop out" onClick={onPopOut} />}</header>
          <div className="msn-wk-b">{body ?? <ProgramSlot holder={holder} />}</div>
        </section>
      </div>
    </Layer>
  );
}
