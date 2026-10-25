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

export function RenameSceneDialog({ title, onCancel, onSave }: { title: string; onCancel(): void; onSave(title: string): void }): JSX.Element {
  const [value, setValue] = useState(title);
  return (
    <InkDialog onDismiss={onCancel} ariaLabel="Rename scene">
      <form className="scn-cut" onSubmit={(e) => { e.preventDefault(); onSave(value); }}>
        <h3>Rename scene</h3>
        <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} aria-label="Scene title" />
        <div className="row"><button type="button" className="no" onClick={onCancel}>Cancel</button><button type="submit" className="yes">Rename</button></div>
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
        <div className="row"><button type="button" className="no" onClick={onCancel}>Cancel</button><button type="button" className="yes" onClick={onCut}>Delete</button></div>
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
        <div className="row"><button type="button" className="no" onClick={onCancel}>Cancel</button><button type="submit" className="yes">{mode === "new" ? "Create" : "Rename"}</button></div>
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
        <div className="row"><button type="button" className="no" onClick={onCancel}>Cancel</button><button type="button" className="yes" onClick={onDelete}>Delete</button></div>
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
          <button type="button" className={!scene.folderId ? "on" : undefined} onClick={() => onPick(null)}>No folder</button>
          {folders.map((f) => (
            <button type="button" key={f.id} className={scene.folderId === f.id ? "on" : undefined} onClick={() => onPick(f.id)}>
              <span className="ch-dot" style={{ background: folderTint(f.id) }} />{f.name}
            </button>
          ))}
        </div>
        <div className="row"><button type="button" className="no" onClick={onCancel}>Cancel</button></div>
      </div>
    </InkDialog>
  );
}
