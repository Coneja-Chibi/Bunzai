/**
 * In-scene search and Jump to latest for the scene page, ported from RoleCall (Ctrl+F opens ChatSearchOverlay;
 * SceneJumpToLatestButton sits over the transcript once the reader is away from the bottom). The page gives this
 * hook its scroller and a loader for older pages and renders the two elements it returns; everything else lives here.
 *
 * Search asks the store (ChatStore rule 35), so the whole take is searched without more than one page of it in the
 * page. Going to a hit that is not on the page loads the pages between it and the loaded ones in one step
 * (use-scene-older-page.ts `loadOlder(untilSeq)`), then scrolls to it and rings it for two seconds, as RoleCall does.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type JSX, type RefObject } from "react";
import type { AppContext } from "../../app-contract";
import { toErrorMessage } from "../../_shared/error-message";
import { IconButton } from "../../components/button";
import { useDialogEscape } from "../../_shared/use-escape-key";
import { searchTerms } from "../../../core/scene-search";
import type { SceneSearchResult } from "../../../studio/scene-search";
import type { OpenScene } from "../../../studio/scenes";
import { FindPanel } from "./scene-find";
import { filterCounts, showJumpToLatest, stepResult, visibleHits, type FindFilter, type FindSort } from "./scene-find-core";

/** How long a typed query waits before it is sent; RoleCall searches on every key, but its search is a loop in memory. */
const DEBOUNCE_MS = 150;
/** RoleCall clears the ring after two seconds (page.tsx:2715-2731). */
const RING_MS = 2000;

type Found = { query: string; branchId: string; result: SceneSearchResult };

const messageEl = (scroller: HTMLElement | null, id: string): HTMLElement | null =>
  [...(scroller?.querySelectorAll<HTMLElement>("[data-mid]") ?? [])].find((el) => el.dataset["mid"] === id) ?? null;

export function useSceneFind(input: {
  api: AppContext["api"];
  chatId: string;
  scene: OpenScene | null;
  scroller: RefObject<HTMLDivElement | null>;
  busy: boolean;
  /** Loads older pages until the message at this sequence is in; false when nothing was loaded. */
  loadThrough(seq: number): Promise<boolean>;
  setStatus(text: string): void;
  names: { character: string; persona: string };
}): { overlay: JSX.Element | null; jump: JSX.Element | null } {
  const { api, chatId, scene, scroller, busy, setStatus } = input;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [filter, setFilter] = useState<FindFilter>("all");
  const [sort, setSort] = useState<FindSort>("newest");
  const [selected, setSelected] = useState(0);
  const [pending, setPending] = useState<{ id: string; seq: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const ring = useRef<{ el: HTMLElement; timer: ReturnType<typeof setTimeout> } | null>(null);
  const latest = useRef(input);
  latest.current = input;
  const branchId = scene?.chat.activeBranchId ?? "";
  const version = scene?.branchVersion ?? 0;

  const clearRing = useCallback((): void => {
    if (!ring.current) return;
    clearTimeout(ring.current.timer);
    ring.current.el.removeAttribute("data-hit");
    ring.current = null;
  }, []);
  const close = useCallback((): void => {
    setOpen(false);
    setQuery("");
    setFound(null);
    setFailed(null);
    setFilter("all");
    setSelected(0);
    setPending(null);
    clearRing();
  }, [clearRing]);
  useEffect(() => clearRing, [clearRing]);

  // Ctrl+F (Cmd+F) opens it from anywhere, typing included (useChatKeyboardShortcuts.ts, allowInInput).
  useEffect(() => {
    if (!scene) return;
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "f") return;
      e.preventDefault();
      setOpen(true);
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [scene !== null]); // eslint-disable-line react-hooks/exhaustive-deps -- only whether a scene is open matters
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  // Esc closes it before it can stop a running reply (a modal owner of the Escape arbiter); a press outside closes it too (ChatSearchOverlay.tsx:274-286).
  useDialogEscape(rootRef, close, open);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      if (e.target instanceof Node && rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, close]);

  // The search itself: debounced, one in flight that matters, and again whenever the take changes under an open panel.
  const terms = useMemo(() => searchTerms(query), [query]);
  const asked = query.trim().length >= 2 && terms.length > 0;
  useEffect(() => {
    if (!open || !asked) { setFound(null); setSearching(false); setFailed(null); return; }
    let stale = false;
    setSearching(true);
    const timer = setTimeout(() => {
      api.searchScene(chatId, query).then((result) => {
        if (stale) return;
        setFound({ query, branchId: result.branchId, result });
        setFailed(null);
        setSearching(false);
      }, (error: unknown) => {
        if (stale) return;
        setFailed(`Search failed: ${toErrorMessage(error)}`);
        setSearching(false);
      });
    }, DEBOUNCE_MS);
    return () => { stale = true; clearTimeout(timer); };
  }, [open, asked, query, api, chatId, branchId, version]);

  // The last answer for this take stays up while the next one is on its way, so typing does not blank the list.
  const answer = found && found.branchId === branchId ? found : null;
  const current = answer?.result ?? null;
  const shownTerms = useMemo(() => searchTerms(answer?.query ?? ""), [answer]);
  const hits = useMemo(() => visibleHits(current?.hits ?? [], filter, sort), [current, filter, sort]);
  const counts = useMemo(() => filterCounts(current?.hits ?? []), [current]);
  const at = Math.min(selected, Math.max(0, hits.length - 1));
  useEffect(() => { setSelected(0); }, [filter, sort]);

  // The jump: show the message once it is on the page, ring it, and say so if it is gone.
  const reveal = useCallback((el: HTMLElement): void => {
    clearRing();
    el.scrollIntoView?.({ block: "center" });
    el.setAttribute("data-hit", "");
    ring.current = { el, timer: setTimeout(clearRing, RING_MS) };
  }, [clearRing]);
  useEffect(() => {
    if (!pending) return;
    const el = messageEl(scroller.current, pending.id);
    if (el) { reveal(el); setPending(null); return; }
    const first = scene?.messages[0];
    if (!scene?.hasMore || (first && first.seq <= pending.seq)) {
      setStatus("that message is no longer in this scene");
      setPending(null);
    }
  }, [pending, scene?.messages, scene?.hasMore]); // eslint-disable-line react-hooks/exhaustive-deps -- reveal and setStatus are stable; only the page changing matters
  const go = useCallback((index: number): void => {
    const hit = hits[index];
    if (!hit) return;
    setSelected(index);
    const state = latest.current;
    const onPage = (): boolean => state.scene?.messages.some((m) => m.id === hit.messageId) === true;
    if (onPage()) { setPending({ id: hit.messageId, seq: hit.seq }); return; }
    void state.loadThrough(hit.seq).then((loaded) => {
      if (loaded) setPending({ id: hit.messageId, seq: hit.seq });
      else latest.current.setStatus("could not reach that message yet; try again");
    });
  }, [hits]);

  // Jump to latest: its own scroll listener, so the page's onScroll stays as it was.
  const [away, setAway] = useState(false);
  useEffect(() => {
    const measure = (): void => {
      const el = scroller.current;
      if (el) setAway(showJumpToLatest(el.scrollHeight - el.scrollTop - el.clientHeight, busy));
    };
    const onScroll = (e: Event): void => { if (e.target === scroller.current) measure(); };
    measure();
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, [scroller, busy, scene?.messageCount, scene?.chat.activeBranchId]);
  const toLatest = (): void => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; };

  const overlay = open && scene ? (
    <FindPanel rootRef={rootRef} inputRef={inputRef} query={query} terms={shownTerms} hits={hits} counts={counts} filter={filter} sort={sort} selected={at}
      searched={asked} searching={searching} failed={failed} totalCount={current?.totalCount ?? scene.messageCount} truncated={current?.truncated ?? false}
      names={input.names} now={new Date()} onQuery={(q) => { setQuery(q); setSelected(0); }} onFilter={setFilter} onSort={setSort}
      onGo={go} onStep={(d) => go(stepResult(at, hits.length, d))} onClose={close} />
  ) : null;
  const jump = away ? (
    <div className="jtl"><IconButton icon="lucide:chevron-down" label="Jump to latest" onClick={toLatest} /></div>
  ) : null;
  return { overlay, jump };
}
