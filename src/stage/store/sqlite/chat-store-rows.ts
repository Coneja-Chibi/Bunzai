/** Sealed ChatStore SQL row shapes and column selectors shared by its backend methods. */
import type { Chat, MessageRole } from "../../contracts/chat-store";
import { publicSummary } from "../summary-rules";
import type { SummaryCell } from "./chat-store-summary";

export interface ChatSql {
  id: string;
  title: string;
  cast_json: string;
  active_branch_id: string;
  created_at: number;
  updated_at: number;
  snapshot_version: number;
  deleted_at: number | null;
  previous_cast_json: string | null;
  connection_json: string | null;
  preset_json: string | null;
  lore_json: string | null;
  props_json: string | null;
  opening_json: string | null;
  prompting_json: string | null;
  backdrop_json: string | null;
  compendium_json: string | null;
  participants_json: string | null;
  regex_json: string | null;
  trackers_json: string | null;
  final_cut_json: string | null;
  summary_json: string | null;
  director_json: string | null;
  favored_at: number | null; folder_id: string | null; variant_id: string | null;
}
export interface BranchSql {
  id: string;
  chat_id: string;
  name: string;
  parent_branch_id: string | null;
  fork_message_id: string | null;
  fork_swipe_id: string | null;
  created_at: number;
  version: number;
  deleted_at: number | null;
}
export interface MessageSql {
  id: string;
  branch_id: string;
  seq: number;
  role: MessageRole;
  current_swipe: number;
  created_at: number;
  cut_id: string | null;
  cut_at: number | null;
  cut_scope: "one" | "from" | null;
  cut_tail: number | null;
  /** Sealed persona stamp (rule 26): null column = no stamp, sealed "null" = no persona. */
  persona_json: string | null;
  /** 1 while the message is left out of the prompt (rule 30). */
  hidden: number;
}
export interface SwipeSql {
  message_id: string;
  position: number;
  swipe_id: string;
  content: string;
  created_at: number;
  pinned: number;
  generation_json: string | null;
  /** Epoch ms the version was removed (rule 32), null while live. */
  cut_at: number | null;
}

export const CHAT_COLUMNS = "id, title, cast_json, active_branch_id, created_at, updated_at, snapshot_version, deleted_at, previous_cast_json, connection_json, preset_json, lore_json, props_json, opening_json, prompting_json, backdrop_json, compendium_json, regex_json, trackers_json, final_cut_json, summary_json, director_json, participants_json, favored_at, folder_id, variant_id";
/** The sealed cells added after rule 41, opened by the caller's cipher, so toChat takes them in one line. The summary cell holds the takes' texts too; only the settings and the failure ride on the chat. */
export function sceneCells(r: ChatSql, open: (column: string, cell: string) => unknown): Pick<Chat, "regex" | "trackers" | "finalCut" | "summary" | "director"> {
  const summary = r.summary_json === null ? undefined : (open("chats.summary_json", r.summary_json) as SummaryCell);
  const shown = summary ? publicSummary(summary.settings, summary.error) : undefined;
  return {
    ...(r.regex_json === null ? {} : { regex: open("chats.regex_json", r.regex_json) as NonNullable<Chat["regex"]> }),
    ...(r.trackers_json === null ? {} : { trackers: open("chats.trackers_json", r.trackers_json) as NonNullable<Chat["trackers"]> }),
    ...(r.final_cut_json === null ? {} : { finalCut: open("chats.final_cut_json", r.final_cut_json) as NonNullable<Chat["finalCut"]> }),
    ...(shown ? { summary: shown } : {}),
    ...(r.director_json === null ? {} : { director: open("chats.director_json", r.director_json) as NonNullable<Chat["director"]> }),
  };
}
export const BRANCH_COLUMNS = "id, chat_id, name, parent_branch_id, fork_message_id, fork_swipe_id, created_at, version, deleted_at";
export const FORK_POSITION = "CASE WHEN fork_message_id IS NULL OR (SELECT 1 FROM messages f WHERE f.id = branches.fork_message_id) IS NULL THEN NULL ELSE (SELECT count(*) FROM messages m WHERE m.branch_id = branches.parent_branch_id AND m.cut_id IS NULL AND m.seq <= (SELECT f.seq FROM messages f WHERE f.id = branches.fork_message_id)) END";
export const MESSAGE_COLUMNS = "id, branch_id, seq, role, current_swipe, created_at, cut_id, cut_at, cut_scope, cut_tail, persona_json, hidden";
