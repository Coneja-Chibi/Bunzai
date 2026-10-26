/**
 * The two engine steps on the canvas (dashed, not pieces): the Lore pass, and the Request with its
 * scene picker and Preview. Both only report; neither writes anything.
 */
import { useState } from "react";
import type { CSSProperties, JSX, PointerEvent } from "react";
import type { SceneSummary } from "../../../../studio/scenes";
import { InkDialog } from "../../../components/ink-dialog";
import { Stamp } from "../../../components/stamp";
import { ENGINE_W, LORE_H, REQUEST_H, tokLabel, type LoreStats, type RequestView } from "./pipeline";
import css from "./nodes.module.css";

export interface LoreNodeProps {
  at: readonly [number, number];
  stats: LoreStats | null;
  /** a character or persona is feeding the pass */
  hasContext: boolean;
  onDown(e: PointerEvent): void;
}

export function LoreNode(p: LoreNodeProps): JSX.Element {
  const lines = !p.hasContext ? ["no character or persona on the canvas"]
    : !p.stats ? ["no lorebooks linked"]
    : [`${p.stats.alwaysOn} always-on of ${p.stats.entries} entries · ${tokLabel(p.stats.alwaysOnTokens)} tok`, `${p.stats.books} book${p.stats.books === 1 ? "" : "s"} · keyword entries fire once there is a story`];
  return (
    <div className={css.eng} style={{ left: p.at[0], top: p.at[1], width: ENGINE_W, height: LORE_H } as CSSProperties} data-engine="lore" onPointerDown={p.onDown}>
      <div className={css.engKind}>Engine step</div>
      <div className={css.engName}>Lore pass</div>
      <div className={css.engMeta}>{lines.map((l) => <div key={l}>{l}</div>)}</div>
    </div>
  );
}

export interface RequestNodeProps {
  at: readonly [number, number];
  view: RequestView;
  scenes: readonly SceneSummary[];
  sceneId: string | null;
  onScene(id: string | null): void;
  /** the canvas's presets to build from; empty while a scene names its own (then there is nothing to choose) */
  presets: readonly { id: string; name: string }[];
  presetId: string | null;
  onPreset(id: string): void;
  onDown(e: PointerEvent): void;
}

export function RequestNode(p: RequestNodeProps): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div className={css.eng} style={{ left: p.at[0], top: p.at[1], width: ENGINE_W, height: REQUEST_H } as CSSProperties} data-engine="request" onPointerDown={p.onDown}>
      <div className={css.engKind}>Output</div>
      <div className={css.engName}>The request</div>
      <select
        className={css.engSelect}
        aria-label="Scene feeding the request"
        value={p.sceneId ?? ""}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => p.onScene(e.target.value || null)}
      >
        <option value="">No scene (dry run)</option>
        {p.scenes.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
      </select>
      {p.presets.length > 1 && (
        <select
          className={css.engSelect}
          aria-label="Preset the request is built from"
          value={p.presetId ?? ""}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => p.onPreset(e.target.value)}
        >
          {p.presets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      )}
      <div className={css.engMeta}>{p.view.lines.map((l) => <div key={l}>{l}</div>)}</div>
      <div className={css.engAct} onPointerDown={(e) => e.stopPropagation()}>
        <Stamp onClick={() => setOpen(true)}>Preview</Stamp>
      </div>
      {open && (
        <InkDialog ariaLabel="Request preview" onDismiss={() => setOpen(false)}>
          <div className={css.preview} data-part="nodes.preview" onPointerDown={(ev) => ev.stopPropagation()}>
            <h3>{p.view.basis === "forecast" ? "The scene's request" : "Dry run"}</h3>
            {p.view.notes.map((n) => <p key={n} className={css.previewNote}>{n}</p>)}
            {p.view.messages.length === 0 && <p className={css.previewNote}>Nothing to send yet.</p>}
            {p.view.messages.map((m, i) => (
              <div key={i} className={css.previewMsg}>
                <b>{m.role}<small> · {tokLabel(m.tokens)} tok</small></b>
                <pre>{m.content}</pre>
              </div>
            ))}
            <div className={css.engAct}><Stamp onClick={() => setOpen(false)}>Close</Stamp></div>
          </div>
        </InkDialog>
      )}
    </div>
  );
}
