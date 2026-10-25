/**
 * The Casting Call: the one persona picker (RoleCall's SatelliteOrbiters PersonaQuickSwap, in the
 * approved Cast wing wireframe). The Cast wing's Pass ticket opens it today; the composer's persona chip
 * will open the same module. A search box (from four personas up), a grid of portrait tiles, the Lead
 * Role card for the one picked (with the persona's own scene count), and Clear role / Cast. It only
 * chooses: casting a different persona is confirmed and run by the caller.
 */
import { useEffect, useMemo, useRef, useState, type JSX, type KeyboardEvent } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { usePortraitAsset } from "../../_shared/art-cache";
import { portraitUrl } from "../../_shared/asset-url";
import { Ic } from "../../_shared/ic";
import { useEscapeKey } from "../../_shared/use-escape-key";
import { filterPersonas, gridColumns } from "./cast/cast-core";

/** What a tile needs, read off a persona's library summary. */
export interface PickerPersona { id: string; name: string; emoji?: string; tagline?: string; hasPortrait: boolean; version?: number; revision?: string }

export function pickerPersonas(list: readonly StudioEntitySummary[]): PickerPersona[] {
  return list.map((s) => ({
    id: s.id, name: s.name || "Unnamed", hasPortrait: s.hasPortrait === true,
    ...(s.facts?.persona?.emoji ? { emoji: s.facts.persona.emoji } : {}),
    ...(s.facts?.persona?.tagline ? { tagline: s.facts.persona.tagline } : {}),
    ...(s.version === undefined ? {} : { version: s.version }),
    ...(s.revision === undefined ? {} : { revision: s.revision }),
  }));
}

/** A persona's portrait, or its emoji, or its initial. */
/** A persona's portrait, else its picked emoji, else its initial. */
export function PersonaFace({ persona, className }: { persona: PickerPersona; className?: string }): JSX.Element {
  const art = usePortraitAsset("persona", persona.id, persona.version, persona.hasPortrait ? portraitUrl("persona", persona.id) : null, persona.revision);
  return (
    <span className={className ?? "face"}>
      {art.src ? <img ref={art.ref as never} src={art.src} alt="" /> : <span className="fb">{persona.emoji || persona.name.charAt(0).toUpperCase()}</span>}
    </span>
  );
}

/** The Casting Call: search, portrait tiles, the Lead Role card, Clear role and Cast. It only chooses; the caller confirms and casts. */
export function PersonaPicker({ ctx, personas, activeId, defaultId, busy, onCast, onNew, onClose }: {
  ctx: AppContext;
  personas: readonly PickerPersona[];
  /** the persona this scene plays now */
  activeId: string | null;
  /** the persona new scenes start with (the setting) */
  defaultId: string | null;
  busy: boolean;
  /** null clears the role */
  onCast(personaId: string | null): void;
  /** make a new persona instead */
  onNew(): void;
  onClose(): void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(activeId);
  const box = useRef<HTMLElement>(null);
  /** Where focus was when the Casting Call opened, so closing it puts the person back there. */
  const opener = useRef<Element | null>(typeof document === "undefined" ? null : document.activeElement);
  const [scenes, setScenes] = useState<number | null>(null);
  const shown = useMemo(() => filterPersonas(personas, query), [personas, query]);
  const lead = personas.find((p) => p.id === selected) ?? null;
  const api = ctx.api;
  useEscapeKey(onClose, true);
  useEffect(() => {
    // Focus goes into the picker (the lead tile, else the first control) and comes back to the trigger on close.
    const el = box.current;
    (el?.querySelector<HTMLElement>('[role="option"][tabindex="0"]') ?? el?.querySelector<HTMLElement>("input, button"))?.focus();
    const back = opener.current;
    return () => { if (back instanceof HTMLElement && back.isConnected) back.focus(); };
  }, []);
  useEffect(() => {
    setScenes(null);
    if (!selected) return;
    let live = true;
    api.personaStats(selected).then((s) => live && setScenes(s.scenes), () => undefined);
    return () => { live = false; };
  }, [api, selected]);
  /** Tab stays inside the Casting Call while it is open. */
  const trap = (e: KeyboardEvent<HTMLElement>): void => {
    if (e.key !== "Tab") return;
    const items = [...(box.current?.querySelectorAll<HTMLElement>('input, button:not([disabled]), [tabindex="0"]') ?? [])];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    const here = document.activeElement;
    if (e.shiftKey && here === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && here === last) { e.preventDefault(); first.focus(); }
  };
  /** Arrow keys walk the tiles (a listbox): left and right by one, up and down by a row, Home and End to the ends. */
  const walk = (e: KeyboardEvent<HTMLElement>): void => {
    const tiles = [...(e.currentTarget.querySelectorAll<HTMLElement>('[role="option"]'))];
    const at = tiles.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    const cols = gridColumns(tiles.length);
    const to = ({ ArrowRight: at + 1, ArrowLeft: at - 1, ArrowDown: at + cols, ArrowUp: at - cols, Home: 0, End: tiles.length - 1 } as Record<string, number>)[e.key];
    if (to === undefined || to < 0 || to >= tiles.length) return;
    e.preventDefault();
    tiles[to]!.focus();
  };
  if (personas.length === 0) {
    return (
      <aside className="cw-cc" role="dialog" aria-label="Casting Call" data-part="scene.cast.picker" ref={box} onKeyDown={trap}>
        <div className="hd"><b>Casting Call</b><span>Select your role</span></div>
        <div className="empty"><b>No Talent Yet</b>Make your first persona with New persona, then come back here.</div>
        <div className="cw-acts"><button type="button" className="go" onClick={onNew}>New persona</button><button type="button" onClick={onClose}>Close</button></div>
      </aside>
    );
  }
  return (
    <aside className="cw-cc" role="dialog" aria-label="Casting Call" data-part="scene.cast.picker" ref={box} onKeyDown={trap}>
      <div className="hd"><b>Casting Call</b><span>Select your role</span></div>
      {personas.length >= 4 && (
        <label className="srch"><Ic name="lucide:search" size={14} /><input value={query} placeholder="Search talent..." aria-label="Search talent" onChange={(e) => setQuery(e.target.value)} /></label>
      )}
      <div className="grid" style={{ "--cols": gridColumns(shown.length) } as React.CSSProperties} role="listbox" aria-label="Personas" onKeyDown={walk}>
        {shown.map((p) => (
          <button type="button" key={p.id} role="option" aria-selected={p.id === selected} tabIndex={p.id === (selected ?? shown[0]?.id) ? 0 : -1} className={`tile${p.id === selected ? " sel" : ""}`} onClick={() => setSelected(p.id)}>
            {p.id === defaultId && <span className="cw-dd" title="Your default persona" />}
            <PersonaFace persona={p} className="ph" />
            <span className="cw-cap">{p.name}</span>
          </button>
        ))}
      </div>
      {lead && (
        <div className="lead">
          <PersonaFace persona={lead} className="ph" />
          <div><div className="k">Lead role</div><div className="n">{lead.name}</div><div className="s">{scenes === null ? "..." : <><b>{scenes}</b> {scenes === 1 ? "scene" : "scenes"}</>}</div>
            {lead.tagline && <div className="q">&ldquo;{lead.tagline}&rdquo;</div>}</div>
        </div>
      )}
      <div className="cw-acts">
        <button type="button" disabled={busy || activeId === null} onClick={() => onCast(null)}>Clear role</button>
        <button type="button" className="go" disabled={busy || !selected || selected === activeId} onClick={() => selected && onCast(selected)}>Cast</button>
      </div>
      <div className="cw-acts"><button type="button" onClick={onNew}>New persona</button><button type="button" className="close" onClick={onClose}>Close</button></div>
    </aside>
  );
}
