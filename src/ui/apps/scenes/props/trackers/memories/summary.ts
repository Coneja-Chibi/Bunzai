/** Memories' card line: memories kept and how many NPCs they belong to. */
import { liveMemories, npcNames, readMemories } from "../../../../../../core/trackers/memories";
import { count } from "../summary";

export function summaryLine(data: unknown): string {
  const m = readMemories(data);
  const n = liveMemories(m).length;
  return n === 0 ? "" : `${count(n, "memory", "memories")} · ${count(npcNames(m).length, "NPC")}`;
}
