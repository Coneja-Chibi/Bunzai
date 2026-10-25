/** /export [md|json]: write the current session's transcript to the exports directory. Defaults to
 * markdown; any unrecognized format falls back to markdown at the formatter. Fail-closed if unwired. */
import type { KitCommand } from "../../commands/command";
import { SESSIONS_UNAVAILABLE, type SessionCommandContext } from "../session-actions";

const command: KitCommand = {
  name: "/export",
  summary: "export the current session as markdown or json",
  run: (ctx: SessionCommandContext) => {
    if (!ctx.sessions) return ctx.say(SESSIONS_UNAVAILABLE);
    const format = ctx.arg.trim().toLowerCase() === "json" ? "json" : "markdown";
    return ctx.sessions.exportTranscript(format);
  },
};

export default command;
