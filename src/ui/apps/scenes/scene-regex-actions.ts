/**
 * The Regex tab's actions, one place for every presentation of it (the Final Cut wing's Regex tab and the Messenger's Regex Workshop): the library list in the person's saved order,
 * switching a set on for the scene, a drag or arrow-key reorder (the saved order is the pref `scenes.regexOrder`, the scene's order is `picks.replace`), Edit in the Workbench, New,
 * and Delete (the library set, then off the scene). Nothing here draws; the callers do.
 */
import { useState, type DragEvent, type KeyboardEvent } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { toErrorMessage } from "../../_shared/error-message";
import { createBlank } from "../../_shared/new-piece";
import { REGEX_ORDER_KEY, inSavedOrder, movedTo, selectedInOrder } from "./scene-regex-core";
import type { SceneRegexPicks } from "./use-scene-regex-picks";

export interface RegexActions {
  /** The library's sets in the saved order; empty until the library is read. */
  list: StudioEntitySummary[];
  error: string | null;
  /** The set waiting on the delete confirmation. */
  ask: StudioEntitySummary | null;
  setAsk(set: StudioEntitySummary | null): void;
  dragging: string | null;
  setDragging(id: string | null): void;
  toggle(id: string): void;
  reorder(from: string, to: string): void;
  edit(set: StudioEntitySummary): void;
  make(): void;
  remove(set: StudioEntitySummary): Promise<void>;
  drop(e: DragEvent, to: string): void;
  /** Arrow up or down on a set's grip moves it one place. */
  gripKey(e: KeyboardEvent, id: string): void;
}

export function useRegexActions(ctx: AppContext, picks: SceneRegexPicks): RegexActions {
  const [saved, setSaved] = useState<unknown>(() => ctx.prefs.get(REGEX_ORDER_KEY));
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<StudioEntitySummary | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const { library } = picks;
  const list = library.state === "ready" ? inSavedOrder(library.sets, saved) : [];
  const fail = (e: unknown, what: string): void => setError(toErrorMessage(e, what));
  const toggle = (id: string): void => { setError(null); void picks.setOn(id, !picks.on.includes(id)).catch((e: unknown) => fail(e, "The regex script could not be switched.")); };
  const reorder = (from: string, to: string): void => {
    const ids = movedTo(list.map((s) => s.id), from, to);
    ctx.prefs.set(REGEX_ORDER_KEY, ids);
    setSaved(ids);
    void picks.replace(selectedInOrder(ids, picks.on)).catch((e: unknown) => fail(e, "The regex scripts could not be reordered."));
  };
  const edit = (s: StudioEntitySummary): void => { ctx.workbench.open({ id: s.id, kind: "regex", name: s.name }); ctx.openApp("workbench"); };
  const make = (): void => {
    setError(null);
    createBlank(ctx, "regex").then((made) => { picks.reload(); ctx.workbench.open({ id: made.id, kind: "regex", name: made.name }); ctx.openApp("workbench"); }, (e: unknown) => fail(e, "The regex script could not be made."));
  };
  const remove = async (s: StudioEntitySummary): Promise<void> => {
    setAsk(null);
    try {
      await ctx.api.deleteEntity("regex", s.id);
      if (picks.on.includes(s.id)) await picks.setOn(s.id, false);
      picks.reload();
    } catch (e) {
      fail(e, "The regex script could not be deleted.");
    }
  };
  const drop = (e: DragEvent, to: string): void => { e.preventDefault(); if (dragging) reorder(dragging, to); setDragging(null); };
  const gripKey = (e: KeyboardEvent, id: string): void => {
    const at = list.findIndex((x) => x.id === id);
    const to = e.key === "ArrowUp" ? list[at - 1] : e.key === "ArrowDown" ? list[at + 1] : undefined;
    if (to) { e.preventDefault(); reorder(id, to.id); }
  };
  return { list, error, ask, setAsk, dragging, setDragging, toggle, reorder, edit, make, remove, drop, gripKey };
}
