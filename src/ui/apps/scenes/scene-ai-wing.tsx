/**
 * The AI wing's Model tab, RoleCall's ModelSelector (`ModelSelector.tsx:433-856`) on Kit's saved connections: the
 * AI Brain hero and close button, a search, the connection pills led by "+ Connect Provider" and "All Providers",
 * Currently Selected, Favorites, then each connection's models. The rows are one windowed list (model-rows-core.ts),
 * so a provider with hundreds of models draws only what is on screen. A connection scenes cannot use is listed
 * greyed with its reason; one whose list fails says so inline, offers Retry and still offers the model saved on it.
 * Picking a row is the scene's pick (ChatStore rule 18). Favorites are a studio pref.
 */
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type JSX, type RefObject } from "react";
import type { AppContext } from "../../app-contract";
import { Ic } from "../../_shared/ic";
import { FALLBACK_VIEWPORT, OVERSCAN, useVirtualRows } from "../../_shared/virtual-list";
import type { Chat, ChatConnection } from "../../../stage/contracts/chat-store";
import { modelRows, type ModelRow } from "./model-rows-core";
import { contextOf, keyOf, useSceneModels, type SceneModels } from "./use-scene-models";

const TONES = ["var(--deck-preset)", "var(--deck-lorebook)", "var(--deck-regex)", "var(--deck-character)", "var(--deck-persona)", "var(--stage-var)"];

/** Opens Kit's connections in Settings, the one place keys are kept. */
export function openKitConnections(ctx: AppContext): void {
  window.location.hash = "settings/models";
  ctx.openApp("settings");
}

export function AiWing({ ctx, chat, onPicked, onClose }: { ctx: AppContext; chat: Chat; onPicked(chat: Chat): void; onClose?(): void }): JSX.Element {
  const sm = useSceneModels(ctx, chat, onPicked);
  const { conns } = sm;
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const scroll = useRef<HTMLDivElement>(null);
  const tone = useMemo(() => new Map((conns ?? []).map((c, i) => [c.id, TONES[i % TONES.length]!])), [conns]);
  const hero = (
    <>
      <Hero />
      {onClose && <div className="ms-close"><button type="button" aria-label="Close panel" onClick={onClose}><Ic name="lucide:x" size={16} /></button></div>}
    </>
  );

  if (conns && conns.length === 0) {
    return (
      <div className="wbody ms" data-part="scene.ai.models">
        {hero}
        <div className="ms-empty"><b>No connections yet</b>Bunraku talks to AI models through the connections you save in Kit: a provider, its key, and a model. Add one there, and it shows up here for every scene.<br />
          <button type="button" className="go" onClick={() => openKitConnections(ctx)}>Open Kit connections</button></div>
      </div>
    );
  }
  return (
    <div className="wbody ms" ref={scroll} data-part="scene.ai.models">
      {hero}
      <div className="ms-sec"><label className="ms-search"><Ic name="lucide:search" /><input value={query} placeholder="Search models..." aria-label="Search models" onChange={(e) => setQuery(e.target.value)} /></label></div>
      <div className="ms-sec"><div className="pills">
        <button type="button" className="pill add" onClick={() => openKitConnections(ctx)}><b>+</b> Connect Provider</button>
        <button type="button" className={`pill all${filter === "all" ? " on" : ""}`} onClick={() => setFilter("all")}>All Providers</button>
        {(conns ?? []).map((c) => (
          <button type="button" key={c.id} className={`pill${filter === c.id ? " on" : ""}${c.unavailable ? " off" : ""}`} style={{ "--tone": tone.get(c.id) } as CSSProperties}
            title={c.unavailable} onClick={() => setFilter(c.id)}><Ic name="lucide:cpu" size={12} />{c.label}</button>
        ))}
      </div></div>
      {conns ? <ModelList sm={sm} chat={chat} query={query} filter={filter} scroll={scroll} tone={tone} /> : <div className="ms-list"><div className="loading"><Ic name="lucide:loader-circle" />Reading your connections...</div></div>}
    </div>
  );
}

const HEIGHT = { hd: 52, model: 94, na: 120, note: 70, load: 40 } as const;

function ModelList({ sm, chat, query, filter, scroll, tone }: { sm: SceneModels; chat: Chat; query: string; filter: string; scroll: RefObject<HTMLDivElement | null>; tone: Map<string, string> }): JSX.Element {
  const rows = useMemo(
    () => modelRows({ conns: sm.conns ?? [], models: sm.models, favorites: sm.favorites, current: chat.connection, query, filter }),
    [sm.conns, sm.models, sm.favorites, chat.connection, query, filter],
  );
  const inner = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);
  // The list sits under the hero, search and pills inside the one scroller; the windowing needs that offset.
  useLayoutEffect(() => {
    const s = scroll.current, l = inner.current;
    if (s && l) setMargin(l.getBoundingClientRect().top - s.getBoundingClientRect().top + s.scrollTop);
  }, [scroll]);
  const virtual = useVirtualRows({ mode: "variable", count: rows.length, getScrollElement: () => scroll.current, getItemKey: (i) => rows[i]!.key, estimateSize: (i) => HEIGHT[rows[i]!.kind], overscan: OVERSCAN, scrollMargin: margin, initialRect: FALLBACK_VIEWPORT });
  // A row measures itself where there is layout; with none (a test DOM) it keeps its estimate rather than collapsing to 0.
  const measure = (el: HTMLDivElement | null): void => { if (el && el.getBoundingClientRect().height > 0) virtual.measureElement(el); };
  const none = !rows.some((r) => r.kind !== "hd" && !(r.kind === "model" && r.current));
  return (
    <div className="ms-list">
      <div className="in" ref={inner} style={{ height: virtual.getTotalSize() }}>
        {virtual.getVirtualItems().map((v) => {
          const row = rows[v.index];
          return row ? <div key={row.key} data-index={v.index} ref={measure} className={`mvr ${row.kind}`} style={{ transform: `translateY(${String(v.start - margin)}px)` }}><RowView row={row} sm={sm} tone={tone} /></div> : null;
        })}
      </div>
      {none && <div className="ms-none">No models found</div>}
    </div>
  );
}

function RowView({ row, sm, tone }: { row: ModelRow; sm: SceneModels; tone: Map<string, string> }): JSX.Element {
  if (row.kind === "hd") return <div className={`grp-hd ${row.variant === "grp" ? "" : row.variant}`}><Ic name={row.variant === "sel" ? "lucide:check" : row.variant === "fav" ? "lucide:star" : "lucide:layers"} />{row.label}<span className="rule" /></div>;
  if (row.kind === "load") return <div className="loading"><Ic name="lucide:loader-circle" />{row.text}</div>;
  if (row.kind === "note") {
    const retry = row.retry;
    return <div className="ms-note">{row.text}{retry && <> <button type="button" className="retry" onClick={() => sm.retry(retry)}>Retry</button></>}</div>;
  }
  if (row.kind === "na") return <div className="mrow na" style={{ "--tone": "var(--stage-mute)" } as CSSProperties}><div className="t">{row.name}</div><div className="sub">{row.sub}</div><div className="why">{row.why}</div></div>;
  const c: ChatConnection = row.conn;
  const chip = row.window ? contextOf(row.window).replace(/^ · /, "") : "";
  return (
    <div className="mwrap">
      <button type="button" className={`mrow${row.current ? " cur" : ""}${row.on && !row.current ? " on" : ""}`} style={{ "--tone": tone.get(c.id) } as CSSProperties} onClick={() => sm.pick(c)}>
        <div className="t">{row.current && <Ic name="lucide:layers" size={16} />}{row.name}{chip && <span className="chip">{chip}</span>}</div>
        <div className="sub">{row.sub}</div>
        {row.current && <span className="state">Active</span>}
        {row.on && !row.current && <span className="tick"><Ic name="lucide:check" size={16} /></span>}
      </button>
      {!row.current && (
        <button type="button" className={`star${row.favorite ? " on" : ""}`} aria-pressed={row.favorite} aria-label={row.favorite ? "Remove from favorites" : "Add to favorites"} onClick={() => sm.toggleFavorite(keyOf(c))}><Ic name="lucide:star" size={16} /></button>
      )}
    </div>
  );
}

function Hero(): JSX.Element {
  return (
    <div className="ms-hero">
      <header className="hero"><span className="hi"><Ic name="lucide:cpu" size={20} /></span><div><div className="eb">AI Brain</div><h2>Select AI <em>Model</em></h2>
        <p>Pick which model writes the scene. Switch any time mid-chat; the new model picks up where the last left off using the same preset and lorebooks.</p></div></header>
    </div>
  );
}
