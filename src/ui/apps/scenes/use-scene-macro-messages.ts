/** Resolves only off-page message cells requested by visible scene macros, in versioned batches. */
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { AppContext } from "../../app-contract";
import { toErrorMessage } from "../../_shared/error-message";
import type { Message } from "../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../studio/scenes";

export function useSceneMacroMessages(input: {
  api: AppContext["api"];
  chatId: string;
  scene: OpenScene | null;
  generation: { current: number };
  indices: number[];
  messages: Map<number, { role: Message["role"]; content: string }>;
  setMessages: Dispatch<SetStateAction<Map<number, { role: Message["role"]; content: string }>>>;
  load(): void;
  setStatus(text: string): void;
}) {
  const [resolving, setResolving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const job = useRef(0);
  const { api, chatId, scene, generation, indices, messages, setMessages, load, setStatus } = input;
  useEffect(() => {
    if (!scene || indices.length === 0) { setResolving(false); setFailed(false); return; }
    const counter = job;
    const id = ++counter.current;
    const sceneGeneration = generation.current;
    const currentScene = scene;
    setFailed(false);
    setResolving(true);
    void (async () => {
      const resolved = new Map(messages);
      for (let i = 0; i < indices.length; i += 60) {
        const requestedIndices = indices.slice(i, i + 60);
        const page = await api.getSceneMacroMessages({
          chatId: chatId,
          branchId: currentScene.chat.activeBranchId,
          expectedVersion: currentScene.branchVersion,
          indices: requestedIndices,
        });
        if (id !== job.current || sceneGeneration !== generation.current || page.branchId !== currentScene.chat.activeBranchId || page.branchVersion !== currentScene.branchVersion) return;
        if (page.messages.length !== requestedIndices.length) {
          setStatus("some scene macro messages were unavailable; reload the scene to try again");
          setFailed(true);
          return;
        }
        for (const item of page.messages) resolved.set(item.index, { role: item.role, content: item.content });
      }
      if (id === job.current) setMessages(resolved);
    })().catch((error: unknown) => {
      if (id === job.current) {
        const stale = /\bversion\b|409/i.test(toErrorMessage(error));
        setStatus(stale ? "the scene changed while its macros were loading; it has been reloaded" : `could not resolve scene macros: ${toErrorMessage(error)}`);
        setFailed(true);
        if (stale) load();
      }
    }).finally(() => { if (id === job.current) setResolving(false); });
    return () => { if (counter.current === id) counter.current++; };
  }, [api, chatId, generation, indices, load, messages, scene, setMessages, setStatus, attempt]);
  return { resolving, failed, retry: () => setAttempt((value) => value + 1) };
}
