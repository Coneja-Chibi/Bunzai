/** The memory ChatStore's half of a scene born with its history (spec rule 29): the messages, in order, and the persona counters they earn. */
import type { Branch, Cast, ChatHistory } from "../../contracts/chat-store";
import { personaDaysOf } from "../persona-stats-rules";
import type { MessageRecord } from "./chat-records";
import type { StatsCounters } from "./chat-store-stats";

export function seedHistory(
  history: ChatHistory,
  branch: Branch,
  cast: Cast,
  messages: Map<string, MessageRecord>,
  order: string[],
  newId: () => string,
  stats: StatsCounters,
): void {
  history.messages.forEach((m, i) => {
    const message: MessageRecord = {
      id: newId(), branchId: branch.id, seq: i + 1, role: m.role, current: m.current, createdAt: m.createdAt,
      swipes: m.swipes.map((s) => ({ id: newId(), content: s.content, createdAt: s.createdAt, pinned: false, history: [], ...(s.generation ? { generation: s.generation } : {}) })),
      ...(m.persona ? { persona: m.persona } : {}),
      ...(m.hidden ? { hidden: true as const } : {}),
    };
    messages.set(message.id, message);
    order.push(message.id);
    branch.version += 1;
  });
  for (const [who, written] of personaDaysOf(history, cast)) stats.messages(who, written.length, written);
}
