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
import { Button, Chip, IconButton, ListRow } from "../../components/button";
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
      {onClose && <div className="ms-close"><IconButton variant="quiet" size="sm" label="Close panel" icon="lucide:x" onClick={onClose} /></div>}
    </>
  );

  if (conns && conns.length === 0) {
    return (
      <div className="wbody ms" data-part="scene.ai.models">
        {hero}
        <div className="ms-empty"><b>No connections yet</b>Bunzai talks to AI models through the connections you save in Kit: a provider, its key, and a model. Add one there, and it shows up here for every scene.<br />
          <Button variant="primary" size="sm" onClick={() => openKitConnections(ctx)}>Open Kit connections</Button></div>
      </div>
    );
  }
  return (
    <div className="wbody ms" ref={scroll} data-part="scene.ai.models">
      {hero}
      <div className="ms-sec"><label className="ms-search"><Ic name="lucide:search" /><input value={query} placeholder="Search models..." aria-label="Search models" onChange={(e) => setQuery(e.target.value)} /></label></div>
      <div className="ms-sec"><div className="pills">
        <Chip onClick={() => openKitConnections(ctx)}><b>+</b> Connect Provider</Chip>
        <Chip pressed={filter === "all"} onClick={() => setFilter("all")}>All Providers</Chip>
        {(conns ?? []).map((c) => (
          <Chip key={c.id} pressed={filter === c.id} title={c.unavailable} onClick={() => setFilter(c.id)}><Ic name="lucide:cpu" size={12} />{c.label}</Chip>
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
    return <div className="ms-note">{row.text}{retry && <> <Button variant="quiet" size="sm" onClick={() => sm.retry(retry)}>Retry</Button></>}</div>;
  }
  if (row.kind === "na") return <div className="mrow na" style={{ "--tone": "var(--stage-mute)" } as CSSProperties}><div className="t">{row.name}</div><div className="sub">{row.sub}</div><div className="why">{row.why}</div></div>;
  const c: ChatConnection = row.conn;
  const chip = row.window ? contextOf(row.window).replace(/^ · /, "") : "";
  return (
    <div className="mwrap">
      <ListRow variant="option" selected={row.on || row.current} accent={tone.get(c.id)} onClick={() => sm.pick(c)}
        label={<>{row.current && <Ic name="lucide:layers" size={16} />}{row.name}{chip && <span className="chip">{chip}</span>}</>}
        subtitle={row.sub} meta={row.current ? "Active" : undefined} />
      {!row.current && (
        <IconButton variant="quiet" size="sm" aria-pressed={row.favorite} label={row.favorite ? "Remove from favorites" : "Add to favorites"} icon={<Ic name="lucide:star" size={16} fill={row.favorite} />} onClick={() => sm.toggleFavorite(keyOf(c))} />
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
