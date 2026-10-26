/** Party's card line: the party's name and how many members it has. */
import { liveMembers, readParty } from "../../../../../../core/trackers/party";
import { count } from "../summary";

export function summaryLine(data: unknown): string {
  const p = readParty(data);
  const members = liveMembers(p);
  if (members.length === 0) return "";
  const leader = members.find((m) => m.profileId === p.leaderId);
  return `${p.name}: ${count(members.length, "member")}${leader ? ` · led by ${leader.name}` : ""}`;
}
