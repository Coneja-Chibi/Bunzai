/**
 * The input check for a scene's imported history, shared by the
 * memory and SQLite stores like chat-rules.ts: everything is checked before anything is written, and
 * what comes back is a fresh copy built from exactly the fields the contract names.
 */
import type { ChatHistory, ImportedMessage } from "../contracts/chat-store";
import { isRecord } from "../../core/guards";
import { checkGeneration, checkRole, checkText, fail } from "./chat-rules";
import { checkHidden, checkWhole, isWhole } from "./scalar-rules";


const checkTime = (value: unknown, what: string): number => {
  return checkWhole(value, `${what} must be a time in whole milliseconds`, 0);
};

const checkSource = (value: unknown): string => {
  if (typeof value !== "string" || value === "" || value.length > 200) fail("a history's source must be 1 to 200 characters of text");
  return value;
};

function checkImportedMessage(raw: unknown): ImportedMessage {
  if (!isRecord(raw)) fail("an imported message must be an object");
  const role = checkRole(raw["role"]);
  const swipes = raw["swipes"];
  if (!Array.isArray(swipes) || swipes.length === 0) fail("an imported message needs at least one swipe");
  const current = raw["current"];
  if (!isWhole(current, 0, swipes.length - 1)) fail("the current swipe is out of range");
  if (raw["hidden"] !== undefined) checkHidden(raw["hidden"]);
  const stamp = raw["persona"];
  if (stamp !== undefined) {
    if (role !== "user") fail("only a user message carries a persona");
    if (!isRecord(stamp) || typeof stamp["id"] !== "string" || stamp["id"] === "" || typeof stamp["name"] !== "string" || stamp["name"] === "") fail("a persona stamp needs an id and a name");
  }
  return {
    role,
    createdAt: checkTime(raw["createdAt"], "a message time"),
    current,
    swipes: swipes.map((s: unknown) => {
      if (!isRecord(s)) fail("an imported swipe must be an object");
      const generation = checkGeneration(s["generation"]);
      return { content: checkText(s["content"], "content"), createdAt: checkTime(s["createdAt"], "a swipe time"), ...(generation ? { generation } : {}) };
    }),
    ...(stamp === undefined ? {} : { persona: { id: (stamp as { id: string }).id, name: (stamp as { name: string }).name } }),
    ...(raw["hidden"] === true ? { hidden: true as const } : {}),
  };
}

export function checkHistory(value: unknown): ChatHistory {
  if (!isRecord(value) || !Array.isArray(value["messages"]) || value["messages"].length === 0) fail("history needs a list of messages");
  return {
    createdAt: checkTime(value["createdAt"], "the scene's start time"),
    updatedAt: checkTime(value["updatedAt"], "the scene's last time"),
    messages: value["messages"].map(checkImportedMessage),
    ...(value["source"] === undefined ? {} : { source: checkSource(value["source"]) }),
  };
}
