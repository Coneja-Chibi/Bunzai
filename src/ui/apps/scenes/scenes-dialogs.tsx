/**
 * The Scenes list's dialogs, all on the existing Cutting Room skin (.scn-cut, from the plain list):
 * rename a scene, cut one or several to the Trash, name or rename a folder, delete a folder (the
 * scenes stay), and move a scene into a folder or out of one. The shell's InkDialog is the one modal
 * primitive every app uses.
 */
import { useState, type JSX } from "react";
import { InkDialog } from "../../components/ink-dialog";
import type { SceneFolder } from "../../../stage/contracts/chat-store";
import type { SceneSummary } from "../../../studio/scenes";
import { folderTint } from "./scenes-core";
import { Button, ListRow } from "../../components/button";

export function RenameSceneDialog({ title, onCancel, onSave }: { title: string; onCancel(): void; onSave(title: string): void }): JSX.Element {
  const [value, setValue] = useState(title);
  return (
    <InkDialog onDismiss={onCancel} ariaLabel="Rename scene">
      <form className="scn-cut" onSubmit={(e) => { e.preventDefault(); onSave(value); }}>
        <h3>Rename scene</h3>
        <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} aria-label="Scene title" />
        <div className="row"><Button onClick={onCancel}>Cancel</Button><Button type="submit" variant="primary">Rename</Button></div>
      </form>
    </InkDialog>
  );
}

export function CutSceneDialog({ scenes, onCancel, onCut }: { scenes: SceneSummary[]; onCancel(): void; onCut(): void }): JSX.Element {
  return (
    <InkDialog onDismiss={onCancel} ariaLabel="Cut this story">
      <div className="scn-cut">
        <div className="eb">The Cutting Room</div>
        <h3>{scenes.length === 1 ? "Cut this story?" : `Cut ${scenes.length} stories?`}</h3>
        <p>{scenes.length === 1
          ? `"${scenes[0]!.title}" and every message in it, all of its takes included, go to the Trash. You can restore it for 3 days.`
          : "Every message in them, all of their takes included, go to the Trash. You can restore them for 3 days."}</p>
        <div className="row"><Button onClick={onCancel}>Cancel</Button><Button variant="danger" onClick={onCut}>Delete</Button></div>
      </div>
    </InkDialog>
  );
}

export function FolderNameDialog({ mode, initial, onCancel, onSave }: { mode: "new" | "rename"; initial: string; onCancel(): void; onSave(name: string): void }): JSX.Element {
  const [value, setValue] = useState(initial);
  return (
    <InkDialog onDismiss={onCancel} ariaLabel={mode === "new" ? "New folder" : "Rename folder"}>
      <form className="scn-cut" onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSave(value.trim()); }}>
        <h3>{mode === "new" ? "New folder" : "Rename folder"}</h3>
        <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} aria-label="Folder name" placeholder="Chapter name" />
        <div className="row"><Button onClick={onCancel}>Cancel</Button><Button type="submit" variant="primary">{mode === "new" ? "Create" : "Rename"}</Button></div>
      </form>
    </InkDialog>
  );
}

export function DeleteFolderDialog({ name, onCancel, onDelete }: { name: string; onCancel(): void; onDelete(): void }): JSX.Element {
  return (
    <InkDialog onDismiss={onCancel} ariaLabel="Delete folder">
      <div className="scn-cut">
        <div className="eb">The Cutting Room</div>
        <h3>Delete "{name}"?</h3>
        <p>The folder goes away; the scenes in it stay on your stage, just out of any folder.</p>
        <div className="row"><Button onClick={onCancel}>Cancel</Button><Button variant="danger" onClick={onDelete}>Delete</Button></div>
      </div>
    </InkDialog>
  );
}

export function MoveToFolderDialog({ scene, folders, onCancel, onPick }: {
  scene: SceneSummary;
  folders: (SceneFolder & { count: number })[];
  onCancel(): void;
  onPick(folderId: string | null): void;
}): JSX.Element {
  return (
    <InkDialog onDismiss={onCancel} ariaLabel="Move to folder">
      <div className="scn-cut folder-pick">
        <h3>Move &ldquo;{scene.title}&rdquo;</h3>
        <div className="pick-list">
          <ListRow selected={!scene.folderId} onClick={() => onPick(null)} label="No folder" />
          {folders.map((f) => (
            <ListRow key={f.id} selected={scene.folderId === f.id} onClick={() => onPick(f.id)} leading={<span className="ch-dot" style={{ background: folderTint(f.id) }} />} label={f.name} />
          ))}
        </div>
        <div className="row"><Button onClick={onCancel}>Cancel</Button></div>
      </div>
    </InkDialog>
  );
}
