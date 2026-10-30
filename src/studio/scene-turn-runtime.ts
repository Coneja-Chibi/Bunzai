/** One consumer's live turns and sandbox/inspection waits; durable state remains in ChatStore. */
import { turnGate } from "./scene-turn-gate";
import type { ReviewDecision } from "./scene-turn-review";
import type { RegexAnswer } from "./scene-turn-regex";
import type { SceneTrackersEvent } from "./scene-events";
import { StudioConflictError } from "./errors";

export function createTurnRuntime(onTrackers: (event: SceneTrackersEvent) => void = () => undefined) {
  return {
    closed: false,
    tasks: new Set<Promise<unknown>>(),
    trackerRounds: new Map<string, { controller: AbortController; done: Promise<void> }>(),
    dramaturg: new Map<string, { controller: AbortController; revision: number }>(),
    onTrackers,
    running: new Map<string, { chatId: string; controller: AbortController; starting?: true }>(),
    review: turnGate<ReviewDecision>({ kind: "cancel" }),
    regex: turnGate<RegexAnswer>({ kind: "cancel" }),
  };
}

export type TurnRuntime = ReturnType<typeof createTurnRuntime>;

/** Admit an operation before shutdown and retain it until all its storage work settles. */
export async function runOwnedTask<T>(runtime: TurnRuntime, run: () => Promise<T>): Promise<T> {
  if (runtime.closed) throw new StudioConflictError("the roleplay core is closed");
  const work = Promise.resolve().then(run);
  runtime.tasks.add(work);
  try { return await work; }
  finally { runtime.tasks.delete(work); }
}

/** Claim before the first read, and retain one cancellation signal through startup and streaming. */
export async function runOwnedTurn(runtime: TurnRuntime, chatId: string, run: (controller: AbortController) => Promise<void>): Promise<void> {
  if (runtime.closed) throw new StudioConflictError("the roleplay core is closed");
  const controller = new AbortController();
  const claim = `starting:${crypto.randomUUID()}`;
  runtime.running.set(claim, { chatId, controller, starting: true });
  try { await runOwnedTask(runtime, () => run(controller)); }
  finally { runtime.running.delete(claim); }
}

/** No new work; settle gates and await foreground and tracker writes before the host closes storage. */
export async function closeTurnRuntime(runtime: TurnRuntime): Promise<void> {
  runtime.closed = true;
  for (const turn of runtime.running.values()) turn.controller.abort();
  for (const round of runtime.trackerRounds.values()) round.controller.abort();
  for (const turn of runtime.dramaturg.values()) turn.controller.abort();
  await Promise.allSettled([...runtime.tasks, ...[...runtime.trackerRounds.values()].map((r) => r.done)]);
}
