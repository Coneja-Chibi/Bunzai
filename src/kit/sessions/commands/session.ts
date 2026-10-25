/** /session (alias /sessions): open the resume playbill to browse, resume, rename, or delete sessions.
 * Fail-closed: if the sessions capability is not wired, it says so rather than doing nothing silently. */
import type { KitCommand } from "../../commands/command";
import { SESSIONS_UNAVAILABLE, type SessionCommandContext } from "../session-actions";

const command: KitCommand = {
  name: "/session",
  aliases: ["/sessions"],
  summary: "browse and resume saved sessions",
  run: (ctx: SessionCommandContext) => {
    if (!ctx.sessions) return ctx.say(SESSIONS_UNAVAILABLE);
    ctx.sessions.openPlaybill();
  },
};

export default command;
