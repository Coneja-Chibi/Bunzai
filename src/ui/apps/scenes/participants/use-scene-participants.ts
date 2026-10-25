/**
 * The Participants tab's data and actions: the stored roster for a scene (read once, shared through participants-store.ts), each
 * change sent one after another so a quick second click is never overtaken, and RECONCILE RECENT SCENE's propose, confirm and undo.
 * A failure is shown, never swallowed, and leaves the roster as it was.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Proposal } from "../../../../core/participants/reconcile";
import type { ParticipantChange } from "../../../../stage/contracts/chat-store";
import type { AppContext } from "../../../app-contract";
import { toErrorMessage } from "../../../_shared/error-message";
import { heldParticipants, holdParticipants, useHeldParticipants } from "./participants-store";

export type Reconcile =
  | { state: "idle" }
  | { state: "running" }
  | { state: "proposed"; proposal: Proposal & { messages: number } }
  | { state: "done"; run: string | null; added: number; known: number }
  | { state: "failed"; why: string };

export function useSceneParticipants(ctx: AppContext, chatId: string) {
  const stored = useHeldParticipants(chatId);
  const [error, setError] = useState<string | null>(null);
  const [reconcile, setReconcile] = useState<Reconcile>({ state: "idle" });
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const queue = useRef(Promise.resolve());
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    if (heldParticipants(chatId) !== undefined) return;
    api.current.getSceneParticipants(chatId).then((r) => holdParticipants(chatId, r.participants), (e: unknown) => mounted.current && setError(toErrorMessage(e, "this scene's participants could not be read")));
  }, [chatId]);

  const change = useCallback((c: ParticipantChange): void => {
    queue.current = queue.current.then(async () => {
      try {
        holdParticipants(chatId, (await api.current.changeSceneParticipants(chatId, c)).participants);
        if (mounted.current) setError(null);
      } catch (e) {
        if (mounted.current) setError(toErrorMessage(e, "that change could not be saved"));
      }
    });
  }, [chatId]);

  const run = useCallback(async (count: number): Promise<void> => {
    setReconcile({ state: "running" });
    try {
      const proposal = await api.current.reconcileSceneParticipants(chatId, count);
      if (mounted.current) setReconcile({ state: "proposed", proposal });
    } catch (e) {
      if (mounted.current) setReconcile({ state: "failed", why: toErrorMessage(e, "Reconcile failed") });
    }
  }, [chatId]);

  const confirm = useCallback(async (names: string[]): Promise<void> => {
    if (reconcile.state !== "proposed") return;
    const people = reconcile.proposal.candidates.filter((c) => names.includes(c.name));
    try {
      const done = await api.current.applySceneParticipants(chatId, people);
      holdParticipants(chatId, done.participants);
      if (mounted.current) setReconcile({ state: "done", run: done.run, added: done.added, known: reconcile.proposal.known });
    } catch (e) {
      if (mounted.current) setReconcile({ state: "failed", why: toErrorMessage(e, "Reconcile failed") });
    }
  }, [chatId, reconcile]);

  const undo = useCallback(async (runId: string): Promise<void> => {
    try {
      holdParticipants(chatId, (await api.current.undoSceneParticipants(chatId, runId)).participants);
      if (mounted.current) setReconcile({ state: "idle" });
    } catch (e) {
      if (mounted.current) setError(toErrorMessage(e, "that could not be undone"));
    }
  }, [chatId]);

  return { stored: stored ?? undefined, loaded: stored !== undefined, error, change, reconcile, run, confirm, undo, dismiss: () => setReconcile({ state: "idle" }) };
}
