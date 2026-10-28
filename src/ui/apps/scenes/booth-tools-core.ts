/**
 * What the Control Booth's tool tiles decide before they draw (approved wireframe premiere/scene-pieces.html, 2a), pure so each rule is provable without a render: the icon and the plain
 * words for what a tool does, whether a library entity reads as a tool, what the linked tools cost per reply together, and how much of the model's window that is (no limit is drawn: the
 * bar only shows a share, and shows nothing when the window is not known).
 */
import { isRecord } from "../../../core/guards";
import type { ToolAction, ToolBody } from "../../../entities/tool/schema";
import type { IconName } from "../../_shared/ic";

const ICONS: Record<ToolAction["kind"], IconName> = { roll: "lucide:dices", dice: "lucide:grid-3x3", formula: "lucide:variable", record: "lucide:sticky-note" };
const WORDS: Record<ToolAction["kind"], string> = { roll: "Rolls the dice it is given", dice: "Rolls a dice piece", formula: "Runs a formula", record: "Just notes it" };

export const toolIcon = (action: ToolAction): IconName => ICONS[action.kind];
export const toolWords = (action: ToolAction): string => WORDS[action.kind];

/** The tool body of a library entity as the server returns it, or null when it does not read as one (the tile then says so instead of guessing). */
export function toolBodyOf(entity: unknown): ToolBody | null {
  const body = isRecord(entity) ? entity["body"] : null;
  if (!isRecord(body) || typeof body["name"] !== "string" || typeof body["description"] !== "string" || !Array.isArray(body["fields"])) return null;
  const action = body["action"];
  return isRecord(action) && typeof action["kind"] === "string" && Object.hasOwn(WORDS, action["kind"]) ? (body as unknown as ToolBody) : null;
}

/** What the linked tools cost per reply together: the sum of the costs read so far. */
export const costTotal = (costs: readonly number[]): number => costs.reduce((sum, n) => sum + n, 0);

/** The share of the model's context window the tools take, 0 to 1; null when the window is not known. */
export const windowShare = (tokens: number, window: number | undefined): number | null => (window !== undefined && window > 0 ? Math.min(1, tokens / window) : null);
