/**
 * One act of the Appearance tab (RoleCall's CollapsibleAct, StageSettingsPanel.tsx:1485-1534): a header with a chevron,
 * the title in the display face and, while closed, a one-line status; the body below. All five start open; the fold is
 * kept per user (scenes.stageActs), where RoleCall kept it per browser (F11).
 */
import type { JSX, ReactNode } from "react";
import { Disclosure } from "../../components/button";

export function Act({ id, title, status, open, onToggle, children }: { id: string; title: string; status: string; open: boolean; onToggle(): void; children: ReactNode }): JSX.Element {
  return (
    <section className={`sa-act${open ? " open" : ""}`} aria-label={title} data-part={`scene.stage.act.${id}`}>
      <Disclosure open={open} onClick={onToggle} label={title} summary={!open ? status : undefined} />
      {open && <div className="sa-body">{children}</div>}
    </section>
  );
}
