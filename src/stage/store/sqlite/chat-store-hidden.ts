/** The SQLite ChatStore's hide switch (spec rule 30): one flag on a message, written like a pin. */
import type { ChatStore } from "../../contracts/chat-store";
import { checkGuard } from "../chat-rules";
import { checkHidden } from "../scalar-rules";
import type { ChatSqlKit } from "./chat-store-cuts";

export function hiddenMethods(k: ChatSqlKit): Pick<ChatStore, "setHidden"> {
  return {
    async setHidden(messageId, hidden, guard) {
      checkHidden(hidden);
      const expected = checkGuard(guard);
      return k.write(() => {
        const m = k.writableMessage(messageId);
        if (!m) return null;
        k.requireVersion(k.branchRow(m.branch_id)!, expected);
        if ((m.hidden === 1) !== hidden) {
          k.run("UPDATE messages SET hidden = ? WHERE id = ?", hidden ? 1 : 0, messageId);
          k.bump(m.branch_id);
        }
        return k.messageById(messageId);
      });
    },
  };
}
