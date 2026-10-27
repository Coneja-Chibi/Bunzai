/**
 * The scene preset's reasoning markers, read for the transcript. The Prompting wing only loads the
 * preset while it is open, and a bubble hides its reasoning whether or not any wing is, so the
 * scene reads this one field itself.
 */
import { useEffect, useMemo, useState } from "react";
import type { AppContext } from "../../app-contract";
import { reasoningFormatOf, type ReasoningFormat } from "../../../core/reasoning-tags";
import { readSetupBody } from "../../_shared/writing-setups";
import { resolveReasoning } from "../../../core/reasoning-capture";
import type { ChatPrompting } from "../../../stage/contracts/chat-store";

/** The writing setup's reasoning markers, or undefined when it has none or cannot be read (built-in tags then apply). */
export async function loadReasoning(api: AppContext["api"], setup: { kind: string; id: string }): Promise<ReasoningFormat | undefined> {
  try {
    return reasoningFormatOf((await readSetupBody(api, setup)) ?? undefined);
  } catch {
    return undefined;
  }
}

/** What this scene's replies catch as thinking: the preset's markers with the scene's Catch thinking choice and Start Reply With (resolveReasoning). */
export function useSceneReasoning(api: AppContext["api"], setup: { kind: string; id: string } | undefined, prompting?: ChatPrompting): ReasoningFormat {
  const key = setup ? `${setup.kind}:${setup.id}` : "";
  const [format, setFormat] = useState<ReasoningFormat | undefined>();
  useEffect(() => {
    let live = true;
    setFormat(undefined);
    if (setup) void loadReasoning(api, setup).then((f) => live && setFormat(f));
    return () => { live = false; };
    // the api object is rebuilt on every status change; only which setup it is decides a reload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const capture = prompting?.capture;
  const prefill = prompting?.prefill;
  return useMemo(() => resolveReasoning(format, { ...(capture ? { capture } : {}), ...(prefill ? { prefill } : {}) }), [format, capture, prefill]);
}
