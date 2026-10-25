/** The scene page's own types: the open dialog, the page's rows, and what the stable Bubble-action dispatchers read at call time. */
import type { Message } from "../../../stage/contracts/chat-store";
import type { OpenScene, TakeSummary } from "../../../studio/scenes";
import { personaSwaps } from "../../../core/persona-swaps";

export type Dialog = { kind: "cut-from"; m: Message } | { kind: "fork"; m: Message; n: number; retake?: true } | { kind: "delete-take"; take: TakeSummary } | { kind: "card" } | { kind: "compare"; id: string };
/** The page's rows: a message with its number among the live ones, one restore line per run of a cut, or a "you now play" line where the persona changed. */
export type Row = { kind: "msg"; m: Message; n: number } | { kind: "cut"; id: string; count: number } | { kind: "swap"; id: string; name: string | null };

/** The page's rows for the scene's messages: numbers skip cut messages, a run of one cut is one restore line. */
export function pageRows(scene: OpenScene | null): Row[] {
  const out: Row[] = [];
  const swaps = personaSwaps(scene?.messages ?? []);
  let n = scene?.messageOffset ?? 0;
  for (const m of scene?.messages ?? []) {
    const last = out[out.length - 1];
    if (swaps.has(m.id)) out.push({ kind: "swap", id: m.id, name: swaps.get(m.id)! });
    if (!m.cut) out.push({ kind: "msg", m, n: ++n });
    else if (last?.kind === "cut" && last.id === m.cut.id) last.count++;
    else out.push({ kind: "cut", id: m.cut.id, count: 1 });
  }
  return out;
}

/** Everything a stable Bubble-action dispatcher needs to read at call time, never at closure time:
 * data for id-to-message lookup, and the current render's own closures (so the dispatcher never
 * duplicates their logic - it only ever forwards to whichever one is "latest"). */
export interface LiveScenePage {
  scene: OpenScene | null;
  rows: Row[];
  browse(m: Message, index: number): void;
  saveEdit(m: Message): Promise<void>;
  cut(m: Message, scope: "one" | "from", skipConfirm: boolean): void;
  branch(m: Message, n: number, skipDialog: boolean): void;
  hide(m: Message): void;
  regenerate(): void;
  askAgain(): void;
  continueLast(): void;
  editLast(): boolean;
  startGuided(id?: string, previous?: string): void;
  sendMessage(content: string): Promise<boolean>;
}
