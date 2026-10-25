/**
 * Next send's read of the forecast route (RoleCall `hooks/usePromptPreview.ts`): after a 300 ms pause in typing, ask for the request a send of the draft would build, dropping an
 * answer that a newer request has overtaken. Idle (nothing asked) for an empty draft or while the tab is not the one showing, as RoleCall keeps history shaping lazy.
 */
import { useEffect, useState } from "react";
import type { AppContext } from "../../../app-contract";
import type { SceneForecast } from "../../../app-contract-scenes";
import type { Chat } from "../../../../stage/contracts/chat-store";

export interface ForecastState { forecast: SceneForecast | null; loading: boolean; error: string | null }
const IDLE: ForecastState = { forecast: null, loading: false, error: null };

export function useForecast(ctx: AppContext, chat: Chat, draft: string, on: boolean, debounceMs = 300): ForecastState {
  const [state, setState] = useState<ForecastState>(IDLE);
  const asking = on && draft.trim() !== "";
  useEffect(() => {
    if (!asking) { setState(IDLE); return; }
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    const timer = setTimeout(() => {
      ctx.api.getSceneForecast(chat.id, draft, controller.signal).then(
        (forecast) => { if (!controller.signal.aborted) setState({ forecast, loading: false, error: null }); },
        (e: unknown) => { if (!controller.signal.aborted) setState({ forecast: null, loading: false, error: e instanceof Error && e.message ? e.message : "The forecast could not be built." }); },
      );
    }, debounceMs);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [ctx, chat.id, chat.updatedAt, chat.activeBranchId, draft, asking, debounceMs]);
  return state;
}
