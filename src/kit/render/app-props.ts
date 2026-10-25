/** The public inputs for Kit's imperative terminal shell. */
import type { DeckCount, EntitySummary } from "../bridge";
import type { Session as ChatSession } from "../session";
import type { KitCommand } from "../commands/command";
import type { DoctorResult } from "../doctor/check";
import type { RailSnapshot } from "../tools/tool";
import type { StudioWatchSource } from "../watch/watcher";
import type { SessionStore } from "../sessions/store";
import type { ResumeRequest } from "./use-resume-at-launch";

export interface AppProps {
  studioName: string;
  totalPieces: number;
  decks: DeckCount[];
  pieces?: readonly EntitySummary[];
  /** Person's own groupings, separate from pieces; absent is normal when there are none. */
  groups?: readonly EntitySummary[];
  session: ChatSession;
  commands: KitCommand[];
  onQuit: () => void;
  sessionStore?: SessionStore;
  makeSessionId?: () => string;
  now?: () => number;
  runDoctor?: () => Promise<DoctorResult[]>;
  watchStudio?: StudioWatchSource;
  /** Live rail reader so Kit's session can report visible context without importing render. */
  onRail?: (read: () => RailSnapshot | null) => void;
  /** Restore the most recent session or one named by id; absent opens blank. */
  resume?: ResumeRequest;
}
