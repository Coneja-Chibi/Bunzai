/** /rewind: open the rewind rail over the current session to scrub back to an earlier turn (enter
 * rewinds, f branches). Fail-closed if the sessions capability is not wired. */
import type { KitCommand } from "../../commands/command";
import { SESSIONS_UNAVAILABLE, type SessionCommandContext } from "../session-actions";

const command: KitCommand = {
  name: "/rewind",
  summary: "rewind the current session to an earlier turn",
  run: (ctx: SessionCommandContext) => {
    if (!ctx.sessions) return ctx.say(SESSIONS_UNAVAILABLE);
    ctx.sessions.openRail();
  },
};

export default command;
