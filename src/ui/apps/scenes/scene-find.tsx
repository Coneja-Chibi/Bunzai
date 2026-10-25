/**
 * The in-scene search panel, ported from RoleCall's ChatSearchOverlay.tsx: a box that floats at the top of the
 * transcript with a "Search script" field, the N/M count with previous and next, a Newest/Oldest sort, the
 * All/character/persona/Thinking filters with their counts, the results with the speaker, time and the matching
 * words marked in a trimmed context, and a status bar with the keys. Dumb on purpose: use-scene-find.tsx owns the
 * state. RoleCall's "Load All Messages" button is gone because the store searches the whole take at once.
 */
import type { JSX, KeyboardEvent, RefObject } from "react";
import { Ic } from "../../_shared/ic";
import { markSegments } from "../../../core/scene-search";
import { MAX_SEARCH_HITS } from "../../../core/search/contracts";
import type { SceneSearchHit } from "../../../studio/scene-search";
import { FIND_FILTERS, findStamp, kindOf, scriptParts, type FindFilter, type FindSort } from "./scene-find-core";

export interface FindPanelProps {
  rootRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  terms: string[];
  /** The hits the filter keeps, in the order shown. */
  hits: SceneSearchHit[];
  counts: Record<FindFilter, number>;
  filter: FindFilter;
  sort: FindSort;
  selected: number;
  /** A search has been asked for (two or more characters typed); false shows no results area. */
  searched: boolean;
  searching: boolean;
  failed: string | null;
  totalCount: number;
  truncated: boolean;
  names: { character: string; persona: string };
  now: Date;
  onQuery(query: string): void;
  onFilter(filter: FindFilter): void;
  onSort(sort: FindSort): void;
  /** Go to the hit at this position in `hits`. */
  onGo(index: number): void;
  onStep(delta: 1 | -1): void;
  onClose(): void;
}

/** The script reading first (an *(action)* in italics), then every word marked inside it, so a word inside an action is still marked. */
function Context({ text, terms }: { text: string; terms: string[] }): JSX.Element {
  const marked = (s: string, key: string): JSX.Element[] => markSegments(s, terms).map((part, i) => part.hit ? <mark key={`${key}-${i}`}>{part.text}</mark> : <span key={`${key}-${i}`}>{part.text}</span>);
  return <>{scriptParts(text).map((part, i) => part.action ? <i key={i} className="act">{marked(part.text, `a${i}`)}</i> : marked(part.text, `t${i}`))}</>;
}

export function FindPanel(p: FindPanelProps): JSX.Element {
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (p.hits.length > 0) p.onStep(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (p.hits.length > 0) p.onGo(p.selected);
    }
  };
  const filterLabel = (f: FindFilter): string => f === "character" ? p.names.character : f === "user" ? p.names.persona : f === "all" ? "All" : "Thinking";
  const speaker = (h: SceneSearchHit): string => h.role === "system" ? "System" : h.role === "user" && !h.thinking ? p.names.persona : p.names.character;
  return (
    <div className="find" ref={p.rootRef} role="search" aria-label="Search this scene" onKeyDown={onKeyDown}>
      <div className="fhd">
        <div className="frow">
          <Ic name="lucide:search" size={16} />
          <input ref={p.inputRef} type="text" value={p.query} placeholder="Search script" aria-label="Search script" autoComplete="off" spellCheck={false} onChange={(e) => p.onQuery(e.target.value)} />
          {p.hits.length > 0 && (
            <div className="fnav">
              <span className="fct" aria-live="polite">{p.selected + 1}/{p.hits.length}</span>
              <button type="button" aria-label="Previous result" title="Previous result" onClick={() => p.onStep(-1)}><Ic name="lucide:chevron-up" size={14} /></button>
              <button type="button" aria-label="Next result" title="Next result" onClick={() => p.onStep(1)}><Ic name="lucide:chevron-down" size={14} /></button>
            </div>
          )}
        </div>
        {p.hits.length > 1 && (
          <div className="fsort"><small>Sort</small>
            {(["newest", "oldest"] as const).map((s) => <button key={s} type="button" className={p.sort === s ? "on" : undefined} aria-pressed={p.sort === s} onClick={() => p.onSort(s)}>{s === "newest" ? "Newest" : "Oldest"}</button>)}
          </div>
        )}
      </div>
      <div className="ffil" role="group" aria-label="Filter results">
        {FIND_FILTERS.map((f) => {
          const count = p.counts[f];
          const empty = p.searched && count === 0 && p.filter !== f;
          return (
            <button key={f} type="button" className={`${f}${p.filter === f ? " on" : ""}`} aria-pressed={p.filter === f} disabled={empty} onClick={() => p.onFilter(f)}>
              {filterLabel(f)}{p.searched && p.filter !== f && <span className="n">({count})</span>}
            </button>
          );
        })}
      </div>
      {p.searched && (
        <div className="fres" role="listbox" aria-label="Results">
          {p.failed ? <p className="fnone" role="alert">{p.failed}</p>
            : p.searching && p.hits.length === 0 ? <p className="fnone" role="status">Searching...</p>
            : p.hits.length === 0 ? <p className="fnone" role="status">No matches found in this scene</p>
            : p.hits.map((h, i) => (
              <button key={h.messageId} type="button" role="option" aria-selected={i === p.selected} data-index={i} className={`fhit${i === p.selected ? " on" : ""}`} data-kind={kindOf(h) ?? "system"} onClick={() => p.onGo(i)}>
                <span className="who">{speaker(h)}
                  {h.thinking && <em className="ftag">thinking</em>}
                  {h.hidden && <em className="ftag">hidden</em>}
                  <small>{findStamp(h.createdAt, p.now)}</small>
                </span>
                <span className="ctx"><Context text={h.context} terms={p.terms} /></span>
              </button>
            ))}
        </div>
      )}
      <div className="fst">
        <span>{p.truncated ? `More than ${MAX_SEARCH_HITS} matches: showing the newest ${MAX_SEARCH_HITS}` : `Searching all ${p.totalCount} messages`}</span>
        <span className="keys"><kbd>Up/Down</kbd> step <kbd>Enter</kbd> go <kbd>Esc</kbd> close</span>
      </div>
    </div>
  );
}
