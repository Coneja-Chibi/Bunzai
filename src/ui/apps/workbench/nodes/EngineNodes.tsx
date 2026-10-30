/**
 * The engine steps on the canvas (dashed, not pieces): the Lore pass, and the Request with its scene picker and
 * Preview, which only report; and the feature nodes, whose port draws a wire that places a feature's marker (the caller writes it).
 */
import { useId, useState } from "react";
import type { CSSProperties, JSX, PointerEvent } from "react";
import type { SceneSummary } from "../../../../studio/scenes";
import { InkDialog } from "../../../components/ink-dialog";
import { Button, Dot } from "../../../components/button";
import type { FeatureMarkerSlot } from "../../../../core/preset";
import { markerSlotName } from "../preset/session";
import { ENGINE_W, FEATURE_H, FEATURE_PORT_H, LORE_H, REQUEST_H, featureColor, tokLabel, type LoreStats, type RequestView } from "./pipeline";
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
      <div className={css.engMeta}>{lines.map(/* bounded-ok: tabs, ports, options, chips and per-item detail inside one document */ (l) => <div key={l}>{l}</div>)}</div>
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
        {p.scenes.map(/* bounded-ok: tabs, ports, options, chips and per-item detail inside one document */ (s) => <option key={s.id} value={s.id}>{s.title}</option>)}
      </select>
      {p.presets.length > 1 && (
        <select
          className={css.engSelect}
          aria-label="Preset the request is built from"
          value={p.presetId ?? ""}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => p.onPreset(e.target.value)}
        >
          {p.presets.map(/* bounded-ok: tabs, ports, options, chips and per-item detail inside one document */ (m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      )}
      <div className={css.engMeta}>{p.view.lines.map(/* bounded-ok: tabs, ports, options, chips and per-item detail inside one document */ (l) => <div key={l}>{l}</div>)}</div>
      <div className={css.engAct} onPointerDown={(e) => e.stopPropagation()}>
        <Button size="sm" onClick={() => setOpen(true)}>Preview</Button>
      </div>
      {open && (
        <InkDialog ariaLabel="Request preview" onDismiss={() => setOpen(false)}>
          <div className={css.preview} data-part="nodes.preview" onPointerDown={(ev) => ev.stopPropagation()}>
            <h3>{p.view.basis === "forecast" ? "The scene's request" : "Dry run"}</h3>
            {p.view.notes.map(/* bounded-ok: tabs, ports, options, chips and per-item detail inside one document */ (n) => <p key={n} className={css.previewNote}>{n}</p>)}
            {p.view.messages.length === 0 && <p className={css.previewNote}>Nothing to send yet.</p>}
            {p.view.messages.map(/* bounded-ok: tabs, ports, options, chips and per-item detail inside one document */ (m, i) => (
              <div key={i} className={css.previewMsg}>
                <b>{m.role}<small> · {tokLabel(m.tokens)} tok</small></b>
                <pre>{m.content}</pre>
              </div>
            ))}
            <div className={css.engAct}><Button variant="quiet" onClick={() => setOpen(false)}>Close</Button></div>
          </div>
        </InkDialog>
      )}
    </div>
  );
}

export interface FeatureNodeProps {
  at: readonly [number, number];
  slot: FeatureMarkerSlot;
  /** Where its markers stand in the canvas presets, or null when no preset places it. */
  placedAt: string | null;
  /** why its port cannot be dragged (unsaved Desk edits, a narrow window), or null */
  locked: string | null;
  onDown(e: PointerEvent): void;
  /** the port pressed: the canvas draws the wire (NodeCanvas LayerTools.wire) */
  onPortDown(e: PointerEvent): void;
}

/** A feature that splices into the request (trackers, library trackers, storyboards). Its port is a piece node's port: drag a wire to a block to put its marker there. */
export function FeatureNode(p: FeatureNodeProps): JSX.Element {
  const name = markerSlotName(p.slot);
  const descriptionId = useId();
  return (
    <div
      className={css.eng}
      style={{ left: p.at[0], top: p.at[1], width: ENGINE_W, height: FEATURE_H, "--k": featureColor(p.slot) } as CSSProperties}
      data-feature={p.slot}
      onPointerDown={p.onDown}
    >
      <div className={css.engKind}>Placement</div>
      <div className={css.engName}>{name}</div>
      <div id={descriptionId} className={`${css.engMeta} ${p.placedAt ? css.placementSummary : ""}`} title={p.placedAt ?? undefined}>{p.placedAt ? `Preset marker: ${p.placedAt}` : "No preset marker. Defaults apply only when used."}</div>
      <div className={`${css.port} ${css.featurePort} ${p.placedAt ? css.full : ""}`} style={{ height: FEATURE_PORT_H, "--pc": featureColor(p.slot) } as CSSProperties}>
        <span>Place in preset</span>
        <Dot
          kind="port"
          color={featureColor(p.slot)}
          label={`Place ${name}'s marker`}
          aria-describedby={descriptionId}
          disabled={p.locked !== null}
          title={p.locked ?? "Sets placement, not whether the feature runs. Drag onto a preset block; select its wire and press Delete to restore default placement."}
          onPointerDown={(e) => { e.stopPropagation(); p.onPortDown(e); }}
        />
      </div>
    </div>
  );
}
