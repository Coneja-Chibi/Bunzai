/** Canonical item-delta construction, local patch application, and bounded transport chunking. */
import { kindPartsFor, partNames } from "./piece-parts";
import type { ParsedCanonicalEntity } from "./runtime-schema";
import type { PiecePatch } from "../stage/contracts/content-store";

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object") {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    return ka.length === kb.length && ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

export function buildPiecePatch(
  baseline: ParsedCanonicalEntity,
  next: ParsedCanonicalEntity,
  original?: Record<string, unknown>,
): PiecePatch {
  if (baseline.kind !== next.kind || baseline.id !== next.id) throw new Error("Cannot patch a different piece");
  const kindParts = kindPartsFor(next.kind);
  const head = { ...next } as Record<string, unknown>;
  delete head.original;
  let changedItems: Record<string, unknown> | undefined;
  let order: string[] | undefined;
  if (kindParts) {
    const field = kindParts.itemsField;
    const beforeBody = baseline.body as unknown as Record<string, unknown>;
    const afterBody = next.body as unknown as Record<string, unknown>;
    const before = (beforeBody[field] as unknown[] | undefined) ?? [];
    const after = (afterBody[field] as unknown[] | undefined) ?? [];
    const beforeNames = partNames(baseline);
    const afterNames = partNames(next);
    const byName = new Map(beforeNames.map((name, index) => [name, before[index]] as const));
    changedItems = Object.create(null) as Record<string, unknown>;
    for (let i = 0; i < after.length; i++) {
      const name = afterNames[i]!;
      const prior = byName.get(name);
      if (prior === undefined || (prior !== after[i] && !deepEqual(prior, after[i]))) changedItems[name] = after[i];
    }
    if (beforeNames.length !== afterNames.length || beforeNames.some((name, i) => name !== afterNames[i])) order = afterNames;
    head.body = { ...afterBody, [field]: [] };
  }
  const patch: PiecePatch = { head };
  if (changedItems && Object.keys(changedItems).length) patch.items = changedItems;
  if (order) patch.order = order;
  if (original && Object.keys(original).length) patch.original = original;
  return patch;
}

/** Build one mutation-time inverse/forward delta without walking the sibling item array. */
export function buildTouchedPatch(
  next: ParsedCanonicalEntity,
  items?: Record<string, unknown>,
): PiecePatch {
  const head = { ...next } as Record<string, unknown>;
  delete head.original;
  const parts = kindPartsFor(next.kind);
  if (parts) {
    const body = next.body as unknown as Record<string, unknown>;
    head.body = { ...body, [parts.itemsField]: [] };
  }
  const patch: PiecePatch = { head };
  if (parts && items && Object.keys(items).length) patch.items = items;
  return patch;
}

export function applyPiecePatch(entity: ParsedCanonicalEntity, patch: PiecePatch): ParsedCanonicalEntity {
  const next = { ...(patch.head as Record<string, unknown>) };
  if (entity.original) next.original = entity.original;
  if (patch.original) {
    const original = { ...(entity.original ?? {}) };
    for (const [format, raw] of Object.entries(patch.original)) {
      const prior = original[format];
      original[format] = { ...(prior && typeof prior === "object" ? prior : {}), raw };
    }
    next.original = original;
  }
  const kindParts = kindPartsFor(entity.kind);
  if (kindParts) {
    const currentBody = entity.body as unknown as Record<string, unknown>;
    const nextBody = next.body as Record<string, unknown>;
    const items = (currentBody[kindParts.itemsField] as unknown[] | undefined) ?? [];
    const byName = new Map(partNames(entity).map((name, i) => [name, items[i]] as const));
    const order = patch.order ?? partNames(entity);
    next.body = {
      ...nextBody,
      [kindParts.itemsField]: order.map((name) => patch.items && Object.prototype.hasOwnProperty.call(patch.items, name) ? patch.items[name] : byName.get(name)),
    };
  }
  return next as unknown as ParsedCanonicalEntity;
}

/** Keep each patch below the 32 MiB request ceiling, allowing four UTF-8 bytes per UTF-16 unit. */
export function splitPiecePatch(patch: PiecePatch, currentOrder: readonly string[], maxUnits = 7 * 1024 * 1024): PiecePatch[] {
  const entries = Object.entries(patch.items ?? {});
  const native = (patch as { native?: unknown }).native;
  const present = new Set(currentOrder);
  const output: PiecePatch[] = [];
  let pending: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  const measure = (items: Record<string, unknown>, order?: readonly string[], final = false): number => JSON.stringify({
    head: patch.head, items, ...(order ? { order } : {}), ...(final ? { original: patch.original, native } : {}),
  }).length;
  const emptyRequestSize = JSON.stringify({ head: patch.head, items: {}, ...(patch.order ? { order: [] } : {}) }).length;
  let itemUnits = 0;
  let orderUnits = patch.order ? JSON.stringify(currentOrder).length - 2 : 0;
  let itemCount = 0;
  let pendingNames = new Set<string>();
  const intermediateOrder = (items: Record<string, unknown>): string[] | undefined => patch.order ? [
    ...present, ...Object.keys(items).filter((name) => !present.has(name)),
  ] : undefined;
  const push = (): void => {
    if (!Object.keys(pending).length) return;
    const order = intermediateOrder(pending);
    if (measure(pending, order) >= maxUnits) throw new Error("Editor intermediate order exceeds the safe request size");
    output.push({ head: patch.head, items: pending, ...(order ? { order } : {}) });
    for (const name of Object.keys(pending)) present.add(name);
    pending = Object.create(null) as Record<string, unknown>;
    itemUnits = 0;
    orderUnits = patch.order ? JSON.stringify([...present]).length - 2 : 0;
    itemCount = 0;
    pendingNames = new Set();
  };
  for (const [name, value] of entries) {
    const encodedName = JSON.stringify(name);
    const encodedValue = JSON.stringify(value);
    if (encodedValue === undefined) throw new Error(`Editor item ${name} is not serializable`);
    const itemCost = encodedName.length + encodedValue.length + 1 + (itemCount ? 1 : 0);
    const addsOrder = Boolean(patch.order && !present.has(name) && !pendingNames.has(name));
    const orderCost = addsOrder ? encodedName.length + (present.size || pendingNames.size ? 1 : 0) : 0;
    const candidateSize = emptyRequestSize + itemUnits + itemCost + orderUnits + orderCost;
    if (candidateSize >= maxUnits && itemCount) push();
    const nextNameCost = encodedName.length + encodedValue.length + 1 + (itemCount ? 1 : 0);
    const nextAddsOrder = Boolean(patch.order && !present.has(name) && !pendingNames.has(name));
    const nextOrderCost = nextAddsOrder ? encodedName.length + (present.size || pendingNames.size ? 1 : 0) : 0;
    if (emptyRequestSize + itemUnits + nextNameCost + orderUnits + nextOrderCost >= maxUnits) {
      throw new Error(`Editor item ${name} exceeds the safe request size`);
    }
    pending[name] = value;
    itemUnits += nextNameCost;
    orderUnits += nextOrderCost;
    itemCount++;
    if (nextAddsOrder) pendingNames.add(name);
  }
  if (entries.length) push();
  const final = { head: patch.head, ...(patch.items ? { items: Object.create(null) } : {}), ...(patch.order ? { order: patch.order } : {}), ...(patch.original ? { original: patch.original } : {}), ...(native ? { native } : {}) } as PiecePatch;
  const finalMetaSize = measure({}, patch.order, true);
  if (finalMetaSize >= maxUnits) throw new Error("Editor final patch metadata exceeds the safe request size");
  if (entries.length) {
    const last = output.pop()!;
    const finalOrder = patch.order ?? last.order;
    if (measure(last.items ?? {}, finalOrder, true) >= maxUnits) {
      output.push(last);
      if (patch.order || patch.original || native) output.push(final);
    } else output.push({ ...last, ...(patch.order ? { order: patch.order } : {}), ...(patch.original ? { original: patch.original } : {}), ...(native ? { native } : {}) });
  } else output.push(patch);
  return output;
}
