/**
 * Takes (ChatStore rules 6 and 12; approved wireframe rc-port/scene-messages.html): RoleCall's Scene
 * Takes list under the take pill (switch, rename in place, delete), its "Fork this scene" dialog, and
 * its "Delete this take" dialog. Branch from here and a take's delete skip their dialog when Shift is
 * held; a deleted take goes to the Trash.
 */
import { Fragment, useState, type JSX } from "react";
import { InkDialog } from "../../components/ink-dialog";
import { Ic } from "../../_shared/ic";
import { protect } from "../../_shared/protected-control";
import { isEscapeClose } from "../../_shared/use-escape-key";
import { dayStamp } from "./scene-meta-core";
import type { TakeSummary } from "../../../studio/scenes";
import { affordance, menuView } from "./scene-tree-core";
import { Button, IconButton, ListRow } from "../../components/button";


interface TakesMenuProps {
  takes: TakeSummary[];
  activeId: string;
  onSwitch(id: string): void;
  onRename(id: string, name: string): void;
  onDelete(take: TakeSummary, skipConfirm: boolean): void;
  /** Opens the Branching Tree page (RoleCall's "View Full Branching Tree"); absent: no link. */
  onTree?(): void;
}

/** The pill with its menu (RoleCall's BranchIndicator): the take you are on, a count of how many takes there are, and the sentence RoleCall reads out. */
export function TakesControl({ open, onToggle, ...menu }: TakesMenuProps & { open: boolean; onToggle(): void }): JSX.Element {
  const view = menuView(menu.takes, menu.activeId);
  const active = menu.takes.find((t) => t.id === menu.activeId);
  const original = !active || active.parentBranchId === null;
  const others = view.alternates.length;
  const sentence = affordance(original, others, active?.name);
  return (
    <span className="hold">
      <Button variant="quiet" size="sm" icon="lucide:film" menu tone="var(--bk-scene-accent-text, var(--bk-role-brand-text))" data-part="scene.takes.toggle" aria-expanded={open} aria-label={sentence} title={sentence} onClick={onToggle}>
        {original ? "Director's Cut" : active.name}
        {others > 0 && <span className="cnt">{others + 1}</span>}
      </Button>
      {open && <TakesMenu {...menu} />}
    </span>
  );
}

export function TakesMenu({ takes, activeId, onSwitch, onRename, onDelete, onTree }: TakesMenuProps): JSX.Element {
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const { original, parent, alternates, subs } = menuView(takes, activeId);
  const save = (): void => {
    const name = editing?.name.trim() ?? "";
    if (editing && name && name !== takes.find((t) => t.id === editing.id)?.name) onRename(editing.id, name);
    setEditing(null);
  };
  const meta = (t: TakeSummary): string => `${dayStamp(t.createdAt)}${t.forkPosition ? ` · msg ${t.forkPosition}` : ""} · ${t.messageCount} msgs`;
  const row = (t: TakeSummary, sub = false): JSX.Element => (
    <div key={t.id} className={`take${t.id === activeId ? " cur" : ""}${sub ? " sub" : ""}`}>
      <span className="ic"><Ic name="lucide:film" size={sub ? 12 : 14} /></span>
      {editing?.id === t.id ? (
        <form className="tx" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <input autoFocus value={editing.name} aria-label="Take name" onChange={(e) => setEditing({ id: t.id, name: e.target.value })} onBlur={save}
            onKeyDown={(e) => {
              if (!isEscapeClose(e.nativeEvent)) return;
              e.stopPropagation();
              setEditing(null);
            }} />
        </form>
      ) : (
        <ListRow onClick={() => onSwitch(t.id)} label={t.name} subtitle={meta(t)} />
      )}
      <IconButton variant="quiet" size="sm" icon="lucide:pencil" title="Rename" label={`Rename ${t.name}`} onClick={() => setEditing({ id: t.id, name: t.name })} />
      <span {...protect("take-delete")}><IconButton variant="danger" size="sm" icon="lucide:trash-2" title="Delete take" label={`Delete ${t.name}`} onClick={(e) => onDelete(t, e.shiftKey)} /></span>
      {t.id === activeId && <span className="dot" />}
    </div>
  );
  return (
    <div className="takes" role="menu">
      <div className="hd"><b><Ic name="lucide:film" size={12} />Scene Takes</b><small>Switch between alternate versions</small></div>
      {original && (
        <div className="pad">
          <ListRow selected={original.id === activeId} onClick={() => onSwitch(original.id)} leading={<Ic name="lucide:clapperboard" size={14} />}
            label={<>Original Take <span className="chip">Main</span></>} subtitle="The original scene" trailing={original.id === activeId ? <span className="dot" /> : undefined} />
        </div>
      )}
      {parent && (
        <>
          <div className="sep">Parent Branch</div>
          <div className="pad">
            <ListRow onClick={() => onSwitch(parent.id)} leading={<Ic name="lucide:film" size={14} />} label={parent.name} subtitle={meta(parent)} />
          </div>
        </>
      )}
      {alternates.length > 0 && <div className="sep">Alternate Takes</div>}
      <div className="pad list">
        {alternates.map((t) => (
          <Fragment key={t.id}>
            {row(t)}
            {t.id === activeId && subs.map((s) => row(s, true))}
          </Fragment>
        ))}
      </div>
      <div className="foot">
        {onTree && <ListRow variant="picker" onClick={onTree} leading={<Ic name="lucide:git-branch" size={14} />} label="View Full Branching Tree" />}
        <span className="hint"><Ic name="lucide:lightbulb" size={12} />Create new takes with Branch from here on any message</span>
      </div>
    </div>
  );
}

/** `retake` is Retake from here: the same dialog, told that a fresh reply is written on the new take (message `number` is the one it answers). */
export function ForkDialog({ number, defaultName, retake, onCancel, onCreate }: { number: number; defaultName: string; retake?: boolean; onCancel(): void; onCreate(name: string): void }): JSX.Element {
  const [name, setName] = useState(defaultName);
  return (
    <InkDialog onDismiss={onCancel} ariaLabel={retake ? "Retake from here" : "Fork this scene"}>
      <form className="scn-sheet accent" onSubmit={(e) => { e.preventDefault(); onCreate(name.trim() || defaultName); }}>
        <header className="hd"><div className="eb"><Ic name="lucide:git-branch" size={16} />Scene takes</div><h2>{retake ? "Retake from here" : "Fork this scene"}</h2><p>{retake ? `Create a new take from message ${number} and write a fresh reply to it.` : `Create a new take from message ${number}.`} Your current scene will not change.</p></header>
        <div className="bd">
          <label>Fork name<input autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
          <div className="box"><div className="t">This fork includes</div><ul><li>Every message up to and including message {number}</li><li>The scene&apos;s cast, as it is in this scene</li>{retake && <li>A new reply, written when the take opens</li>}</ul></div>
        </div>
        <footer className="ft"><Button variant="quiet" onClick={onCancel}>Cancel</Button><Button variant="primary" type="submit">{retake ? "Retake" : "Create fork"}</Button></footer>
      </form>
    </InkDialog>
  );
}

export function DeleteTakeDialog({ take, onCancel, onConfirm }: { take: TakeSummary; onCancel(): void; onConfirm(): void }): JSX.Element {
  return (
    <InkDialog onDismiss={onCancel} ariaLabel="Delete this take">
      <div className="scn-sheet">
        <header className="hd"><div className="eb">Scene takes</div><h2>Delete this take</h2><p>{take.name}</p></header>
        <div className="bd"><p>This take and its {take.messageCount} {take.messageCount === 1 ? "message go" : "messages go"} to the Trash. You can restore it for 3 days.</p></div>
        <footer className="ft"><Button autoFocus onClick={onCancel}>Keep take</Button><Button variant="danger" onClick={onConfirm}>Delete take</Button></footer>
      </div>
    </InkDialog>
  );
}
