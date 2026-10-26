/**
 * Manage a scene from the sidebar (backlog slice 4): Rename, Move to folder, Mute and Move to Trash, each through the writer the Scenes list calls (`api.renameScene`, `api.setSceneFolder`,
 * `api.deleteScene`, whose delete is the soft one into the Trash) and its own dialogs (scenes-dialogs.tsx). Trashing the open scene ends the page, as it does from the Scenes list, so it goes
 * through `trashScene`; any other scene is trashed in place and the shared scene list is read again. Nothing here deletes for good.
 */
import { useState, type JSX } from "react";
import type { AppContext } from "../../../../app-contract";
import { toErrorMessage } from "../../../../_shared/error-message";
import type { Chat, SceneFolder } from "../../../../../stage/contracts/chat-store";
import type { SceneSummary } from "../../../../../studio/scenes";
import { CutSceneDialog, MoveToFolderDialog, RenameSceneDialog } from "../../scenes-dialogs";
import { trashScene } from "../../trash-scene";
import type { MenuEntry } from "../frames/context-menu";

/** The row a menu is for: the open scene may not be in the shared list yet, so only its id and title are certain. */
export interface ManagedRow { id: string; title: string; scene: SceneSummary | null }

type Dialog = { kind: "rename" | "cut"; row: ManagedRow } | { kind: "move"; row: ManagedRow; scene: SceneSummary; folders: (SceneFolder & { count: number })[] };

export interface SceneManage {
  /** The menu of one scene row. */
  menu(row: ManagedRow): MenuEntry[];
  /** The open dialog, or null. */
  dialog: JSX.Element | null;
}

export function useSceneManage({ ctx, openId, muted, onToggleMute, onRenamedOpen, onLeave, refresh }: {
  ctx: AppContext;
  openId: string;
  muted: readonly string[];
  onToggleMute(chatId: string): void;
  /** The open scene's new chat (its title shows in the header and the sidebar at once). */
  onRenamedOpen(chat: Chat): void;
  /** The open scene went to the Trash: leave its page. */
  onLeave(): void;
  /** Read the shared scene list again. */
  refresh(): void;
}): SceneManage {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const { api, setStatus } = ctx;
  const close = (): void => setDialog(null);

  const rename = (row: ManagedRow, title: string): void => {
    close();
    const trimmed = title.trim();
    if (!trimmed || trimmed === row.title) return;
    api.renameScene(row.id, trimmed).then((chat) => { if (row.id === openId) onRenamedOpen(chat); refresh(); }, (e: unknown) => setStatus(`could not rename: ${toErrorMessage(e)}`));
  };
  const move = (row: ManagedRow, folderId: string | null): void => {
    close();
    api.setSceneFolder(row.id, folderId).then(refresh, (e: unknown) => setStatus(`could not move that scene: ${toErrorMessage(e)}`));
  };
  const trash = (row: ManagedRow): void => {
    close();
    if (row.id === openId) { trashScene(ctx, row.id, onLeave); return; }
    api.deleteScene(row.id).then(() => { setStatus("Moved to the Trash."); refresh(); }, (e: unknown) => setStatus(`could not move to the Trash: ${toErrorMessage(e)}`));
  };
  const askMove = (row: ManagedRow, scene: SceneSummary): void => {
    api.listSceneFolders().then((folders) => setDialog({ kind: "move", row, scene, folders }), (e: unknown) => setStatus(`could not list folders: ${toErrorMessage(e)}`));
  };

  const menu = (row: ManagedRow): MenuEntry[] => {
    const entries: MenuEntry[] = [
      { id: "rename", label: "Rename", icon: "lucide:pencil", onSelect: () => setDialog({ kind: "rename", row }) },
      ...(row.scene ? [{ id: "move", label: "Move to folder", icon: "lucide:folder" as const, onSelect: () => askMove(row, row.scene!) }] : []),
      { id: "mute", label: muted.includes(row.id) ? "Unmute scene" : "Mute scene", icon: "lucide:ban", onSelect: () => onToggleMute(row.id) },
      { id: "trash-sep", separator: true },
      { id: "trash", label: "Move to Trash", icon: "lucide:trash-2", danger: true, onSelect: () => setDialog({ kind: "cut", row }) },
    ];
    return entries;
  };

  let shown: JSX.Element | null = null;
  if (dialog?.kind === "rename") shown = <RenameSceneDialog title={dialog.row.title} onCancel={close} onSave={(t) => rename(dialog.row, t)} />;
  else if (dialog?.kind === "cut") shown = <CutSceneDialog scenes={[{ title: dialog.row.title }]} onCancel={close} onCut={() => trash(dialog.row)} />;
  else if (dialog?.kind === "move") shown = <MoveToFolderDialog scene={dialog.scene} folders={dialog.folders} onCancel={close} onPick={(id) => move(dialog.row, id)} />;
  return { menu, dialog: shown };
}
