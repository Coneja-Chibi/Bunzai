/**
 * Scene state's shapes (docs/reference/scene-state.md): a slot is one named piece of scene state, a delta is what one
 * reply version changed in it, and the state is every slot's value after the versions that are shown. Types only.
 */
import type { JsonValue } from "../../stage/contracts/chat-store";

/** What one reply version changed: a value at a path inside one slot, or its removal. Values, never operations. */
export interface Delta {
  slot: string;
  path: string[];
  value?: JsonValue;
  removed?: true;
  /** Epoch ms of the write. */
  at: number;
}

/** How a slot's changes are cut into deltas and folded back: the whole value, one delta per field, or one per row of a list. */
export type DiffStrategy = "value" | "fields" | "keyed-list";

export interface SlotDef {
  /** The slot id; ending in `:*` it is a family covering every id with that prefix (slot-lookup.ts). */
  id: string;
  /** Rebuilt from the shown history. Shared slots arrive with a later phase. */
  scope: "scene";
  diff: DiffStrategy;
  /** A keyed-list's row field: a row is addressed by its text. */
  key?: string;
  /** What the slot holds before any delta. */
  default: JsonValue;
}

/** A "fields" slot keeps each field with when it was first written and last written. */
export interface Field { value: JsonValue; createdAt: number; updatedAt: number }

/** Every slot's value, by slot id, after the shown versions. A slot no delta touched is absent. */
export type SceneState = { [slot: string]: JsonValue };

/** A keyframe is kept after every this many shown messages along a path. */
export const KEYFRAME_EVERY = 50;
