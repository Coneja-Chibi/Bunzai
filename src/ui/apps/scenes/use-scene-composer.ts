/**
 * The scene page's composer glue, out of scene-page.tsx (500-line cap): Continue and its Ctrl+Shift+C, the
 * Ctrl+Shift+R chord, Ask again, ArrowUp to edit your last message, the "+" menu's rows and open state, and
 * steering for a guided re-roll (RoleCall's handleGuidedSwipe and handleApplyGuidedSwipe: tail reply only).
 * Every handler here is the same one the bubble's button calls; the page's `regenerate` is passed in because
 * the version browser needs it first. The draft tools' page half is here too: Correct's modal (useSceneCorrect) and the
 * message menu's request to open the composer in expand mode. The chords stand down while a menu (this one too), wing, dialog or editor is open.
 */
import { useCallback, useState, type JSX } from "react";
import type { TextRange } from "../../../core/draft-prompts";
import type { ScenesApi } from "../../app-contract-scenes";
import type { Message } from "../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../studio/scenes";
import { canContinue, isContinueKey, isRegenerateKey } from "./continue-core";
import { composerRows, type ComposerRow } from "./composer-tools-core";
import { INSPECTOR_KEY, readInspector } from "./inspector-core";
import type { ComposerToolsProps } from "./scene-composer-tools";
import type { Row } from "./scene-page-types";
import type { useSceneTurn } from "./use-scene-turn";
import { useChordKey } from "./use-chord-key";
import { useDismissHoldMenus } from "./use-dismiss-hold-menus";
import { useSceneCorrect } from "./use-scene-correct";
import { selectedSwipe } from "./use-scene-swipe-preview";

type MsgRow = Extract<Row, { kind: "msg" }>;
/** The reply being steered and the instruction the box starts with (a version's old one when it is edited). */
export interface Steering { id: string; initial: string }

const NO_REPLY = "No AI message yet to re-roll.";
const BRANCH_REQUIRED = "That reply has later messages beneath it. Create a branch from that point before using Guided Swipe so the existing timeline stays intact.";
const GONE = "That reply is no longer present in this timeline. Reopen Guided Swipe on the reply you want to replace.";

export function useSceneComposer(p: {
  api: Pick<ScenesApi, "runSceneDraft" | "listGuides" | "editSceneMessage">;
  /** The app's per-user prefs: the Prompt Inspector's on/off lives here (inspector-core.ts). */
  prefs: { get(key: string): unknown; set(key: string, value: unknown): void };
  /** Reads the scene again after an edit. */
  reload(): void;
  scene: OpenScene | null;
  rows: Row[];
  lastRow: MsgRow | undefined;
  /** The take's last reply past the greeting: the only one that regenerates. */
  lastReply: Message | null;
  /** The take's last assistant message, the greeting too: the one Continue extends. */
  continueReply: Message | null;
  connected: boolean;
  busy: boolean;
  peeking: boolean;
  /** A page menu, wing, dialog or editor is open. */
  blocked: boolean;
  turn: ReturnType<typeof useSceneTurn>;
  /** A new version of the last reply; `guidance` makes it a guided re-roll. */
  reroll(guidance?: string): void;
  editing: boolean;
  setEditing(edit: { id: string; text: string }): void;
  setStatus(text: string): void;
}): { expandTick: number; beginExpand(): void; correct(id: string, selection?: TextRange | null): void; correctModal: JSX.Element | null; continuable: boolean; continueLast(): void; askAgain(): void; editLast(): boolean; tools: Omit<ComposerToolsProps, "onExpand">; steering: Steering | null; startGuided(id: string | undefined, previous?: string): void; steer(text: string): void; cancelSteer(): void } {
  const { scene, lastRow, lastReply, continueReply, connected, busy, turn, reroll } = p;
  const [steering, setSteering] = useState<Steering | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [inspector, setInspector] = useState(() => readInspector(p.prefs.get(INSPECTOR_KEY)));
  const [expandTick, setExpandTick] = useState(0);
  const beginExpand = useCallback((): void => setExpandTick((n) => n + 1), []);
  const corrector = useSceneCorrect({ api: p.api, scene, reload: p.reload, setStatus: p.setStatus });
  const closeTools = useCallback((): void => setToolsOpen(false), []);
  useDismissHoldMenus(toolsOpen, closeTools);
  /** Continue the last reply, the opening greeting too (turn-loop rule 13): the bubble's button, the menu row and Ctrl+Shift+C all come here. */
  const continuable = canContinue({ reply: continueReply, busy, connected, held: turn.held !== null, peeking: p.peeking });
  const continueLast = (): void => { if (scene && continueReply && continuable) void turn.start("continue", scene.branchVersion, continueReply.id); };
  const quiet = !p.blocked && !toolsOpen;
  useChordKey(isContinueKey, continueLast, continuable && quiet);
  useChordKey(isRegenerateKey, () => reroll(), lastReply !== null && connected && !busy && quiet);
  const askAgain = (): void => {
    if (!scene || !lastRow || busy) return;
    void turn.start("reply", scene.branchVersion, null, lastRow.m.id);
  };
  /** ArrowUp in the empty composer: edit the user's last message. False when it cannot (nothing to edit, a reply running, an edit open). */
  const editLast = (): boolean => {
    const row = [...p.rows].reverse().find((r): r is MsgRow => r.kind === "msg" && r.m.role === "user");
    if (!row || busy || p.editing) return false;
    p.setEditing({ id: row.m.id, text: selectedSwipe(row.m)?.content ?? "" });
    return true;
  };
  /** Steering opens on the tail reply only: `id` undefined is the menu row (the last reply, whichever it is), a bubble's id may be an older one. */
  const startGuided = (id: string | undefined, previous = ""): void => {
    setToolsOpen(false);
    if (busy) return;
    if (id === undefined ? !lastReply : id !== lastReply?.id) p.setStatus(id === undefined ? NO_REPLY : BRANCH_REQUIRED);
    else setSteering({ id: lastReply!.id, initial: previous });
  };
  const steer = (text: string): void => {
    if (!steering) return;
    setSteering(null);
    if (lastReply?.id === steering.id) reroll(text);
    else p.setStatus(scene?.messages.some((m) => m.id === steering.id) ? BRANCH_REQUIRED : GONE);
  };
  const pick = (id: ComposerRow["id"]): void => {
    // A toggle: the menu stays open to show the new state (RoleCall's Debug row).
    if (id === "inspector") { const next = !readInspector(p.prefs.get(INSPECTOR_KEY)); p.prefs.set(INSPECTOR_KEY, next); setInspector(next); return; }
    if (id === "guided") return startGuided(undefined);
    setToolsOpen(false);
    if (id === "correct") corrector.openLast();
    else if (id === "continue") continueLast();
    else if (id === "regenerate") {
      if (lastReply) reroll();
      else p.setStatus(NO_REPLY);
    }
  };
  return { expandTick, beginExpand, correct: corrector.open, correctModal: corrector.modal, continuable, continueLast, askAgain, editLast, steering, startGuided, steer, cancelSteer: () => setSteering(null), tools: { open: toolsOpen, rows: composerRows({ busy, connected, continuable, inspector }), onToggle: () => { if (!toolsOpen) setInspector(readInspector(p.prefs.get(INSPECTOR_KEY))); setToolsOpen(!toolsOpen); }, onPick: pick } };
}
