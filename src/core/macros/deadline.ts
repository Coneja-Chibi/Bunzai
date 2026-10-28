/**
 * The time budget a macro run may be given (MacroContext.deadline: a point in time and the caller's own clock, since the engine reads no
 * ambient time, ADR-012). The evaluator checks it between nodes and after every handler (a soft deadline is only watched by the handlers); a handler whose work scales with its input (the
 * word-watching macros' index and phrase matching) checks it inside its loops through `deadlineTicker`, so one long node cannot run past
 * it. A run that passes its deadline stops with the error DEADLINE_MESSAGE, which lands in the caller's macro report like any other.
 */
import { DEADLINE_CHECK_EVERY } from "./limits";
import type { MacroContext } from "./types";

export const DEADLINE_MESSAGE = "the time budget for this run is spent; stopped";

/** Thrown out of a handler's loop when the run's deadline has passed; the handler turns it into a failed result. */
export class DeadlineExceeded extends Error {
  constructor() {
    super(DEADLINE_MESSAGE);
  }
}

/** The context without its deadline: a clock is a function, which a copy cannot hold, and a run that is not the one the deadline was given for (a formula's, a view's re-render) must not inherit a spent one. */
export const withoutDeadline = <C extends Pick<MacroContext, "deadline">>(context: C): Omit<C, "deadline"> => {
  const { deadline: _clock, ...rest } = context;
  return rest;
};

export const pastDeadline = (context: Pick<MacroContext, "deadline">): boolean => context.deadline !== undefined && context.deadline.now() > context.deadline.at;

/** Whether the evaluator itself should stop the run: the deadline has passed and it is not a soft one. */
export const stopsRun = (context: Pick<MacroContext, "deadline">): boolean => context.deadline?.soft !== true && pastDeadline(context);

/** A function to call once per iteration of a loop: it reads the clock every DEADLINE_CHECK_EVERY calls and throws DeadlineExceeded once the deadline has passed. */
export function deadlineTicker(context: Pick<MacroContext, "deadline">): () => void {
  if (!context.deadline) return () => undefined;
  let n = 0;
  return () => {
    if (++n % DEADLINE_CHECK_EVERY === 0 && pastDeadline(context)) throw new DeadlineExceeded();
  };
}
