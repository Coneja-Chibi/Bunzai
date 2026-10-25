/** The memory ChatStore's hide switch (spec rule 30): one flag on a message, written like a pin. */
import type { ChatStore } from "../../contracts/chat-store";
import { checkGuard } from "../chat-rules";
import { checkHidden } from "../scalar-rules";
import { publicMessage, type MessageRecord } from "./chat-records";

export function hiddenMethods(k: {
  writableMessage(id: string): MessageRecord | null;
  requireVersion(branchId: string, expected: number | undefined): void;
  bump(branchId: string): void;
}): Pick<ChatStore, "setHidden"> {
  return {
    async setHidden(messageId, hidden, guard) {
      checkHidden(hidden);
      const expected = checkGuard(guard);
      const m = k.writableMessage(messageId);
      if (!m) return null;
      k.requireVersion(m.branchId, expected);
      if (Boolean(m.hidden) !== hidden) {
        if (hidden) m.hidden = true;
        else delete m.hidden;
        k.bump(m.branchId);
      }
      return publicMessage(m);
    },
  };
}
