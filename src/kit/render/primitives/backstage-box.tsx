/** @jsxImportSource @opentui/react */
/**
 * BackstageBox, the live tool cluster (DECISIONS #26): while a turn makes moves, they gather in a
 * bordered box under a legible BACKSTAGE header carrying a running move count. Each move is a structured
 * row whose verb (and spine) is colored by a classic menu palette (cool = safe reads, warm = writes,
 * red = destructive, violet = egress), so a slow tool is named on stage in
 * its own color while it grinds. A running move (no summary yet) pulses middots; a settled move shows its
 * one-line summary. The box seals into a foldable line when the model speaks (see BackstageRow).
 */
import type { ReactNode } from "react";
import { theme } from "../theme";
import type { ToolMove } from "../turn-events";
import type { LoopPhase } from "../../loop/state";
import { lifecycleLabel } from "./lifecycle-label";
import { MoveRow } from "./backstage-move";
import { useTick } from "./use-tick";

const DOTS = [" ·  ", " ·· ", " ···"];

export function BackstageBox({ moves, phase }: { moves: ToolMove[]; phase?: LoopPhase }): ReactNode {
  const tick = useTick(220);
  const dots = DOTS[tick % DOTS.length]!;
  return (
    <box flexDirection="column" border borderColor={theme.line} backgroundColor={theme.floor}>
      <box flexDirection="row" backgroundColor={theme.lift} paddingLeft={1} paddingRight={1}>
        <text fg={theme.soft}>BACKSTAGE</text>
        {phase ? <text fg={theme.teal}> · {lifecycleLabel(phase)}</text> : null}
        <box flexGrow={1} />
        <text fg={theme.quiet}>
          {String(moves.length)} move{moves.length === 1 ? "" : "s"}
        </text>
      </box>
      <box flexDirection="column" paddingLeft={1} paddingRight={1}>
        {moves.map((move, index) => (
          <MoveRow key={index} raw={move.summary ?? move.name} spine="▌ " dots={move.summary === undefined ? dots : undefined} />
        ))}
      </box>
    </box>
  );
}
