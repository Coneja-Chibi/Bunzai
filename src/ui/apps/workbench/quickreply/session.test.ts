/** Regression coverage for quick-reply set editing without executing message payloads. */
import { expect, test } from "bun:test";
import { OccurrenceIndex } from "../../../_shared/editor-state";
import { addReply, bodyFromEntity, patchReply, quickReplyDirty, removeReply, replyTouch } from "./session";

const body = { name: "Commands", replies: [{ id: "one", label: "Go", message: "/send go" }] };

test("quick-reply editing changes only the selected row", () => {
  const added = addReply(body);
  expect(added.replies).toHaveLength(2);
  const edited = patchReply(added, "one", { label: "Begin", hidden: true });
  expect(edited.replies[0]).toMatchObject({ label: "Begin", message: "/send go", hidden: true });
  expect(body.replies[0]!.label).toBe("Go");
});

test("remove and dirty state are structural", () => {
  expect(removeReply(body, "one").replies).toEqual([]);
  expect(quickReplyDirty(structuredClone(body), body)).toBe(false);
  expect(quickReplyDirty({ ...body, name: "Other" }, body)).toBe(true);
});

test("bodyFromEntity clones and falls back to an empty set", () => {
  const out = bodyFromEntity({ body });
  expect(out).toEqual(body);
  expect(out).not.toBe(body);
  expect(bodyFromEntity({ body: { name: 1 } })).toEqual({ name: "Untitled quick replies", replies: [] });
});

test("replyTouch writes only the addressed reply", () => {
  const two = { name: "C", replies: [{ id: "a", label: "A", message: "" }, { id: "b", label: "B", message: "" }] };
  const index = new OccurrenceIndex<(typeof two.replies)[number]>();
  index.rebuild(two.replies, (reply) => reply.id);
  const touch = replyTouch("b", index);
  const next = touch.write!(two, [{ id: "b", label: "B2", message: "" }]);
  expect(next.replies[0]).toBe(two.replies[0]);
  expect(next.replies[1]!.label).toBe("B2");
});
