/**
 * The input check for a stored tree layout, applied by every ChatStore implementation so they
 * cannot keep different things. A layout is parsed once here into a known shape: bounded depth, node count and size, unique node
 * ids, and entry ids that are plain strings. Anything else is refused whole and nothing is stored.
 */
import { isPlainObject, type Rec } from "../../core/guards";
import { TREE_MAX_BYTES, TREE_MAX_DEPTH, TREE_MAX_NODES, type LayoutNode, type StoredLayout } from "../contracts/chat-tree-types";
import { checkText, fail } from "./chat-rules";

const text = (v: unknown, what: string, max: number): string => {
  const t = checkText(v, what);
  return t.length <= max ? t : fail(`${what} must be at most ${max} characters`);
};

function checkNode(value: unknown, depth: number, seen: Set<string>): LayoutNode {
  if (depth > TREE_MAX_DEPTH) return fail(`a layout is at most ${TREE_MAX_DEPTH} levels deep`);
  if (!isPlainObject(value)) return fail("a layout branch must be a plain object");
  const id = text(value["id"], "a branch id", 400);
  if (id === "__proto__" || seen.has(id)) return fail(`a layout has the branch id ${id} twice`);
  seen.add(id);
  if (seen.size > TREE_MAX_NODES) fail(`a layout holds at most ${TREE_MAX_NODES} branches`);
  const entryIds = value["entryIds"];
  const children = value["children"];
  if (!Array.isArray(entryIds) || !Array.isArray(children)) return fail("a branch needs entryIds and children lists");
  return {
    id, label: text(value["label"], "a branch label", 200), summary: text(value["summary"], "a branch summary", 2_000),
    entryIds: entryIds.map((e) => text(e, "an entry id", 200)), children: children.map((c) => checkNode(c, depth + 1, seen)),
  };
}

/** A layout, checked; throws StudioValidationError with the reason. */
export function checkLayout(value: unknown): StoredLayout {
  if (!isPlainObject(value)) return fail("a layout must be a plain object");
  const v: Rec = value;
  const granularity = v["granularity"];
  if (granularity !== 0 && granularity !== 1 && granularity !== 2 && granularity !== 3 && granularity !== 4) fail("granularity must be 0 to 4");
  const detail = v["detail"];
  if (detail !== "names" && detail !== "lite" && detail !== "full") fail("detail must be names, lite or full");
  const layout: StoredLayout = {
    rev: text(v["rev"], "rev", 200), model: text(v["model"], "model", 200), granularity: granularity as StoredLayout["granularity"],
    detail: detail as StoredLayout["detail"], root: checkNode(v["root"], 1, new Set()),
  };
  if (new TextEncoder().encode(JSON.stringify(layout)).length > TREE_MAX_BYTES) fail(`a layout must hold at most ${TREE_MAX_BYTES} bytes of JSON`);
  return layout;
}
