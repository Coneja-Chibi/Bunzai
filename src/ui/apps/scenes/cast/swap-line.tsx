/**
 * The transcript's "you now play X" line (part scene.cast.line), drawn where the persona changed, like the
 * cut line beside it. Derived from the messages' persona stamps (core/persona-swaps.ts), never stored.
 * A null name is the person leaving their persona and playing as User.
 */
import type { JSX } from "react";

/** The transcript's "you now play X" line (part scene.cast.line). */
export function SwapLine({ name }: { name: string | null }): JSX.Element {
  return (
    <div className="swapline" data-part="scene.cast.line" role="separator" aria-label={`You now play ${name ?? "User"}`}>
      <span>You now play <b>{name ?? "User"}</b></span>
    </div>
  );
}
