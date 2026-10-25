/**
 * What the Booth's loadout bar reads: the loadout library and this scene's latest open receipt, both from the library file
 * (no browser storage, no window events), so the banner survives leaving the scene and a reload. `refresh` re-reads both and
 * runs on opening the switcher and after every apply, undo and save.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppContext } from "../../../app-contract";
import type { LoadoutReceipt, LoadoutRecord } from "../../../../studio/loadout-record";
import type { AsyncState } from "../../../_shared/async-state";
import { toErrorMessage } from "../../../_shared/error-message";

export type LoadoutList = AsyncState<{ loadouts: LoadoutRecord[] }>;

export function useSceneLoadouts(ctx: AppContext, chatId: string): { list: LoadoutList; receipt: LoadoutReceipt | null; refresh(): Promise<void> } {
  const [list, setList] = useState<LoadoutList>({ state: "loading" });
  const [receipt, setReceipt] = useState<LoadoutReceipt | null>(null);
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const refresh = useCallback(async () => {
    const [loadouts, latest] = await Promise.allSettled([api.current.listLoadouts(), api.current.latestLoadoutReceipt(chatId)]);
    if (!mounted.current) return;
    setList(loadouts.status === "fulfilled" ? { state: "ready", loadouts: loadouts.value } : { state: "failed", why: toErrorMessage(loadouts.reason, "your loadouts could not be loaded") });
    if (latest.status === "fulfilled") setReceipt(latest.value);
  }, [chatId]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { list, receipt, refresh };
}
