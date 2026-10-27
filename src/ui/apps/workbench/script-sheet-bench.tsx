/**
 * A Script Sheet on the Workbench: RoleCall's sheet editor (RoleCall opens the same editor from its Library,
 * ScriptSheetAuthoring.tsx), with the preset's own settings and samplers above it. Name, instruction and settings save
 * in one revision-checked patch, as the block editor saves, so what the light read does not carry (an imported sheet's
 * escrowed source) is never written over; a newer save elsewhere keeps the draft and says so. The Workbench's guards
 * own the save keys, the unsaved mark on the tab and autosave. A re-read reaches a clean bench (keyed on revision).
 */
import { useMemo, useRef, useState, type JSX } from "react";
import type { ScriptSheetBody } from "../../../entities/scriptsheet/schema";
import type { ParsedCanonicalEntity } from "../../../entities/runtime-schema";
import { recOr } from "../../../core/guards";
import { ApiHttpError } from "../../_shared/api-fetch";
import { toErrorMessage } from "../../_shared/error-message";
import { buildPiecePatch } from "../../_shared/editor-state";
import { ScriptSheetEditor, type SheetDraft, type SheetHandle } from "../../_shared/script-sheet-editor";
import type { KindEditorProps } from "./editors";
import { useEditorGuards } from "./use-editor-guards";
import { setPresetSampler } from "../../../entities/preset/operations";
import { asPresetBody } from "../../../core/writing";
import { createAndOpenPiece } from "../../_shared/new-piece";
import { Button } from "../../components/button";
import { SettingsBar } from "./preset/settings-bar";

/** The patch a bench save sends: only what changed between the saved body and the edited one, never the read's missing escrow. */
export function sheetPatch(entity: unknown, id: string, before: ScriptSheetBody, after: ScriptSheetBody): ReturnType<typeof buildPiecePatch> {
  const as = (body: ScriptSheetBody) => ({ ...recOr(entity), kind: "scriptsheet", id, body }) as ParsedCanonicalEntity;
  return buildPiecePatch(as(before), as(after));
}

export function ScriptSheetBench(props: KindEditorProps): JSX.Element {
  return <Bench key={props.revision} {...props} />;
}

function Bench({ entity, revision, ctx, piece, topRight }: KindEditorProps): JSX.Element {
  // the entity has passed the canonical decoder on its way here
  const base = useMemo(() => recOr(entity).body as unknown as ScriptSheetBody, [entity]);
  // what the library holds now, and the settings being edited over it
  const [committed, setCommitted] = useState<ScriptSheetBody>(base);
  const [settings, setSettings] = useState<ScriptSheetBody>(base);
  const revisionRef = useRef(revision);
  const handle = useRef<SheetHandle | null>(null);
  const [state, setState] = useState({ dirty: false, ready: false });

  const save = async ({ name, content }: SheetDraft): Promise<void> => {
    const body: ScriptSheetBody = { ...settings, name, content };
    try {
      const saved = await ctx.api.patchEditedEntity("scriptsheet", piece.id, revisionRef.current, sheetPatch(entity, piece.id, committed, body));
      revisionRef.current = saved.revision;
      setCommitted(body);
      setSettings(body);
      ctx.setStatus(`saved Script Sheet · ${name}`);
    } catch (e) {
      if (e instanceof ApiHttpError && e.status === 409) throw new Error("This Script Sheet changed somewhere else first. Your draft has been kept; reopen it to see the saved version.");
      throw new Error(toErrorMessage(e, "Could not save this Script Sheet. Your draft has been kept."));
    }
  };
  // a sheet that breaks the rules is not savable, so autosave waits instead of retrying a save that cannot happen
  useEditorGuards(ctx, piece, state.dirty, () => handle.current?.save() ?? Promise.resolve(false), state.ready);

  const edit = (change: (b: ScriptSheetBody) => ScriptSheetBody) => setSettings((b) => change(b));
  /** The family's one step up: a new preset made from the saved sheet (its blocks, samplers and words), opened beside it. */
  const openAsPreset = async (): Promise<void> => {
    try {
      const made = await createAndOpenPiece(ctx, "preset", "preset", asPresetBody("scriptsheet", committed)!);
      ctx.workbench.open(made);
      ctx.setStatus(`made a preset from ${committed.name}`);
    } catch (e) {
      ctx.setStatus(toErrorMessage(e, "could not make a preset from this Script Sheet"));
    }
  };
  return (
    <ScriptSheetEditor actions={<>
        <Button size="sm" variant="quiet" icon="lucide:sliders-horizontal" disabled={state.dirty} title={state.dirty ? "Save first: the preset is made from the saved sheet" : undefined} onClick={() => void openAsPreset()}>Open as preset</Button>
        {topRight}</>} initial={{ name: base.name, content: base.content }} save={save} handle={handle} onState={setState}
        extraDirty={settings !== committed}
        samplers={<SettingsBar body={settings} ctx={ctx} showSamplers
          onDescription={(description) => edit((b) => ({ ...b, description }))}
          onSampler={(key, value) => edit((b) => setPresetSampler(b, key, value))} />} />
  );
}
