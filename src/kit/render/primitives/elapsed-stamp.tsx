/** @jsxImportSource @opentui/react */
/** Shared elapsed clock and deep-rose stamp used by the live terminal progress rows. */
import type { ReactNode } from "react";
import { theme } from "../theme";

export function elapsedClock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function ElapsedStamp({ ms }: { ms: number }): ReactNode {
  return (
    <box backgroundColor={theme.roseDeep} paddingLeft={1} paddingRight={1}>
      <text fg={theme.white}>{elapsedClock(ms)}</text>
    </box>
  );
}
