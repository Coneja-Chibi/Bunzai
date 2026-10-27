/**
 * The Workbench editors: the components, by the id each kind's kind.ts names in `editor`. A browser bundle cannot
 * glob, so an editor is one import line here; a kind with no editor opens read-only.
 */
import type { ComponentType, ReactNode } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { kindOf } from "../../../generated/kinds";
import type { KindEditor } from "../../../entities/_shared/kind-descriptor";
import { CharacterEditor } from "./Editor";
import { PackEditor } from "./PackEditor";
import { LorebookEditor } from "./LorebookEditor";
import { RegexSetEditor } from "./RegexSetEditor";
import { PersonaEditor } from "./PersonaEditor";
import { HtmlDocEditor } from "./htmldoc-editor";
import { PresetEditor } from "./PresetEditor";
import { QuickReplyEditor } from "./QuickReplyEditor";
import { ScriptSheetBench } from "./script-sheet-bench";

/** What every editor is handed: the fetched entity and its revision, the app, the open piece, the hoisted chrome. */
export interface KindEditorProps {
  entity: unknown;
  revision: string;
  ctx: AppContext;
  piece: StudioEntitySummary;
  topRight?: ReactNode;
}

/** Every Workbench editor by its id. Which kind opens in which editor is said in each kind's kind.ts (`editor`). */
export const EDITOR_VIEWS: Readonly<Record<string, ComponentType<KindEditorProps>>> = {
  character: CharacterEditor,
  lorebook: LorebookEditor,
  persona: PersonaEditor,
  pack: PackEditor,
  preset: PresetEditor,
  scriptsheet: ScriptSheetBench,
  regex: RegexSetEditor,
  quickreply: QuickReplyEditor,
  htmldoc: HtmlDocEditor,
};

/** The editor a kind's pieces open in, with how it reads them, or undefined for a kind that opens read-only. */
export function editorFor(kind: string): (KindEditor & { Editor: ComponentType<KindEditorProps> }) | undefined {
  const editor = kindOf(kind)?.editor;
  const Editor = editor && EDITOR_VIEWS[editor.id];
  return editor && Editor ? { ...editor, Editor } : undefined;
}
