/**
 * The composer's draft tools, wired (slice 6): Expand as character and Polish Input. Each asks the scene's
 * model for text through `runSceneDraft` and puts the answer in the composer for the person to edit; nothing
 * is sent and nothing is stored. The menus mount these entry points: `expand(perspective)` is the "+" menu's
 * Expand as character row (the outline is whatever the composer holds, possibly nothing), `beginExpand()` is the
 * message menu's row (it opens expand mode, and uses no message's text), `polish()` is Polish Input. `status`
 * is what the strip above the composer shows (scene-draft-status.tsx).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Perspective } from "../../../core/draft-prompts";
import type { ScenesApi } from "../../app-contract-scenes";
import { toErrorMessage } from "../../_shared/error-message";
import { IDLE, polishOutcome, type DraftStatus } from "./draft-core";

export interface ComposerDrafts {
  status: DraftStatus;
  /** A tool is running: a second request is dropped. */
  busy: boolean;
  expand(perspective: Perspective): void;
  beginExpand(): void;
  polish(): void;
  /** Stops a running tool, leaving the composer alone; after an expansion landed, clears it (RoleCall's cancelImpersonation). */
  cancel(): void;
  /** Puts the text from before the polish pass back. */
  revert(): void;
  dismiss(): void;
}

export function useComposerDrafts({ api, chatId, text, setText }: {
  api: Pick<ScenesApi, "runSceneDraft">;
  chatId: string;
  text: string;
  setText(text: string): void;
}): ComposerDrafts {
  const [status, setStatus] = useState<DraftStatus>(IDLE);
  const live = useRef({ status, text, setText });
  live.current = { status, text, setText };
  const running = useRef<AbortController | null>(null);
  useEffect(() => () => running.current?.abort(), []);

  const run = useCallback(async (kind: "impersonate" | "polish", input: Parameters<ScenesApi["runSceneDraft"]>[0]): Promise<string | null> => {
    const controller = new AbortController();
    running.current = controller;
    setStatus({ tag: "working", kind });
    try {
      return (await api.runSceneDraft(input, controller.signal)).text;
    } catch (e) {
      if (!controller.signal.aborted) setStatus({ tag: "error", text: toErrorMessage(e, kind === "polish" ? "Spellcheck failed" : "Impersonate failed") });
      return null;
    } finally {
      if (running.current === controller) running.current = null;
    }
  }, [api]);

  const expand = useCallback((perspective: Perspective): void => {
    if (running.current) return;
    void run("impersonate", { chatId, kind: "impersonate", brief: live.current.text, perspective }).then((out) => {
      if (out === null) return;
      live.current.setText(out);
      setStatus({ tag: "landed" });
    });
  }, [chatId, run]);

  const polish = useCallback((): void => {
    if (running.current) return;
    const before = live.current.text;
    if (!before.trim()) {
      setStatus({ tag: "note", text: "Type something first to polish." });
      return;
    }
    void run("polish", { chatId, kind: "polish", text: before }).then((out) => {
      if (out === null) return;
      const next = polishOutcome(before, out);
      if (next.tag === "compare") live.current.setText(out);
      setStatus(next);
    });
  }, [chatId, run]);

  const cancel = useCallback((): void => {
    if (running.current) {
      running.current.abort();
      running.current = null;
    } else if (live.current.status.tag === "landed") live.current.setText("");
    setStatus(IDLE);
  }, []);

  const revert = useCallback((): void => {
    if (live.current.status.tag === "compare") live.current.setText(live.current.status.before);
    setStatus(IDLE);
  }, []);

  return { status, busy: status.tag === "working", expand, beginExpand: () => setStatus({ tag: "expand" }), polish, cancel, revert, dismiss: () => setStatus(IDLE) };
}
