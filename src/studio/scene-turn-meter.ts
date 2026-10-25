/**
 * The turn loop and the token meter: the app budgeter's
 * measure comes from what the meter has learned about the scene's model, and each reply's reported
 * usage teaches it more. The meter is one library document (StateStore `meter`, numbers only).
 * Learning is best-effort and after the commit: a lost sample costs nothing but accuracy.
 */
import type { Measure } from "../core/assembly/budget-app";
import { countFramed, countPrompt, estimateFor, learn, parseMeter, partFor, serializeMeter, type Meter, type TokenReport } from "../core/tokens";
import type { StateStore } from "../stage/contracts/state-store";
import { serializer } from "./serial";

export async function readMeter(state: Pick<StateStore, "read">): Promise<Meter> {
  return parseMeter(await state.read("meter")).meter;
}

/** Upper bounds for one model, from a snapshot of the meter taken when the turn began. */
export function measureFor(meter: Meter, key: string, now: number): Measure {
  return {
    whole: (texts) => estimateFor(meter, key, countPrompt(texts), now).bound,
    part: (text) => partFor(meter, key, countFramed(text), now).bound,
  };
}

const enqueueMeterWrite = serializer();

/**
 * Teaches the meter one reply: the base count of what was sent against the prompt total the
 * provider reported. A reply that reports no prompt total teaches nothing. Writes in this process
 * run one at a time, so two scenes never lose each other's samples.
 */
export function learnReply(state: StateStore, key: string, sent: readonly string[], usage: TokenReport | undefined, now: number): Promise<void> {
  const real = usage?.promptTotal;
  if (!real) return Promise.resolve();
  return enqueueMeterWrite(async () => {
    const meter = await readMeter(state);
    learn(meter, key, { sample: { base: countPrompt(sent), real }, ...(usage.cacheRead !== undefined ? { cacheRead: usage.cacheRead } : {}), promptTotal: real }, now);
    await state.write("meter", serializeMeter(meter));
  });
}
