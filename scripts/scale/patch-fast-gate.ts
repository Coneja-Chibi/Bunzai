/** Count the public one-item patch path at N/10N through each throwaway library's registered store. */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "bunraku-scale-patch-"));
process.env["BUNRAKU_HOME"] = join(root, "home");
process.env["LOCALAPPDATA"] = join(root, "local-app-data");
process.env["CODEX_HOME"] = join(root, "codex");
process.env["CLAUDE_CONFIG_DIR"] = join(root, "claude");
process.env["XDG_STATE_HOME"] = join(root, "xdg-state");

interface Result { logicalItems: number; physicalCells: number; sealedBytes: number; requestBytes: number }

interface CipherCounts { opens: Record<string, number>; seals: Record<string, { calls: number; bytes: number }> }

async function observeWarmPatch(n: number): Promise<CipherCounts> {
  const { cellCipher } = await import("../../src/stage/crypto/cell-cipher");
  const { fakeComputer } = await import("../../src/stage/crypto/fake-device-vault");
  const { createKeyring } = await import("../../src/stage/crypto/keyring");
  const { createContentStore } = await import("../../src/stage/store/content-store");
  const { createColdReadService } = await import("../../src/stage/store/cold-read-service");
  const { openStageDatabase } = await import("../../src/stage/store/sqlite/database");
  const { sqliteDocumentBackend } = await import("../../src/stage/store/sqlite/document-backend");
  const { MIGRATIONS } = await import("../../src/stage/store/sqlite/migrations");
  const { preset } = await import("./fixtures/preset");
  const { buildTouchedPatch } = await import("../../src/ui/_shared/editor-patch");
  const { parseStudioPatchRequest } = await import("../../src/ui/_shared/studio-patch-request");
  const dir = join(root, `cipher-counts-${n}`);
  mkdirSync(dir);
  const database = openStageDatabase(join(dir, "library.db"), MIGRATIONS);
  let forget = () => {};
  let closeColdReads = () => {};
  try {
    const keyring = createKeyring(database, fakeComputer());
    forget = () => keyring.forget();
    await keyring.setup();
    const inner = cellCipher(() => keyring.keys());
    const counts: CipherCounts = { opens: {}, seals: {} };
    const cipher = {
      open(where: string, cell: string) { counts.opens[where] = (counts.opens[where] ?? 0) + 1; return inner.open(where, cell); },
      seal(where: string, text: string) { const result = inner.seal(where, text); const row = counts.seals[where] ?? { calls: 0, bytes: 0 }; row.calls++; row.bytes += result.length; counts.seals[where] = row; return result; },
      index: inner.index,
      ready: inner.ready,
    };
    const coldReads = createColdReadService({ database, path: join(dir, "library.db"), cipher, keyring });
    closeColdReads = coldReads.close;
    const content = createContentStore(sqliteDocumentBackend(database, cipher), Date.now, { coldFill: coldReads.fill });
    const entity = preset(n);
    const created = await content.save(entity);
    const mutate = (index: number, revision: string) => {
      const prior = entity.body.prompts[index]!;
      const item = { ...prior, content: `${prior.content} warm edit ${revision}` };
      const next = { ...entity, body: { ...entity.body, prompts: entity.body.prompts.map((value, at) => at === index ? item : value) } };
      const patch = buildTouchedPatch(next, { [`i/${prior.id}`]: item });
      return { item, patch };
    };
    const first = mutate(0, "cache");
    const warmed = await content.patch("preset", entity.id, created.revision, first.patch);
    if (warmed.status !== "saved") throw new Error(`initial cache fill failed: ${warmed.status}`);
    for (const key of Object.keys(counts.opens)) delete counts.opens[key];
    for (const key of Object.keys(counts.seals)) delete counts.seals[key];
    const beforeVersion = Number((database.db.query("SELECT MAX(from_version) AS v FROM piece_parts WHERE kind='preset'").get() as { v: number }).v);
    const second = mutate(1, "measured");
    const wire = { kind: "preset", id: entity.id, expectedRevision: warmed.summary.revision, intent: "manual", ...second.patch };
    const parsed = parseStudioPatchRequest(wire);
    if (!parsed.ok) throw new Error(`measured patch differs from public wire schema: ${parsed.error}`);
    const requestBytes = Buffer.byteLength(JSON.stringify(wire), "utf8");
    const saved = await content.patch("preset", entity.id, warmed.summary.revision, second.patch);
    if (saved.status !== "saved") throw new Error(`measured warm patch failed: ${saved.status}`);
    const rows = database.db.query("SELECT COUNT(*) AS count FROM piece_parts WHERE kind='preset' AND from_version > ?").get(beforeVersion) as { count: number };
    const itemSeals = counts.seals["piece_parts.cell"];
    if (rows.count !== 1 || itemSeals?.calls !== 1 || (counts.opens["piece_parts.cell"] ?? 0) !== 0 || (counts.opens["blobs.cell"] ?? 0) !== 0 || (counts.seals["blobs.cell"]?.calls ?? 0) !== 0) {
      throw new Error(`warm one-item patch violated cell counts: ${JSON.stringify({ rows, counts })}`);
    }
    const budget = 2 * Buffer.byteLength(JSON.stringify(second.item), "utf8") + 8_192;
    if (itemSeals.bytes >= budget || requestBytes >= Buffer.byteLength(JSON.stringify(second.item), "utf8") + 16_384) throw new Error("warm one-item patch exceeded sealed or request byte budget");
    return counts;
  } finally {
    closeColdReads();
    forget();
    database.close();
  }
}

async function patchAt(n: number): Promise<Result> {
  const { openLibrary } = await import("../../src/ui/library-root");
  const { libraryFor } = await import("../../src/studio/library-content");
  const { fakeComputer } = await import("../../src/stage/crypto/fake-device-vault");
  const { preset } = await import("./fixtures/preset");
  const { buildTouchedPatch } = await import("../../src/ui/_shared/editor-patch");
  const { parseStudioPatchRequest } = await import("../../src/ui/_shared/studio-patch-request");
  const studio = join(root, `library-${n}`);
  const opened = await openLibrary(studio, { vault: fakeComputer(), skipOpenMaintenance: true });
  try {
    if (opened.state !== "unlocked") throw new Error(`library ${n} did not unlock`);
    const stores = libraryFor(studio);
    if (!stores) throw new Error("opened library did not register its stores");
    const entity = preset(n);
    const created = await stores.content.save(entity);
    const first = entity.body.prompts[0];
    if (!first) throw new Error("preset fixture has no first item");
    const changed = { ...first, content: `${first.content} edited` };
    const next = { ...entity, body: { ...entity.body, prompts: [changed, ...entity.body.prompts.slice(1)] } };
    const partName = `i/${first.id}`;
    const patch = buildTouchedPatch(next, { [partName]: changed });
    if (Object.keys(patch.items ?? {}).length !== 1) throw new Error("patch builder did not produce exactly one changed item");
    const wire = { kind: "preset", id: entity.id, expectedRevision: created.revision, intent: "manual", ...patch };
    const parsedWire = parseStudioPatchRequest(wire);
    if (!parsedWire.ok) throw new Error(`patch request differs from the public transport schema: ${parsedWire.error}`);
    const requestBytes = Buffer.byteLength(JSON.stringify(wire), "utf8");
    const beforeVersion = Number((opened.database.db.query("SELECT COALESCE(MAX(from_version), 0) AS v FROM piece_parts WHERE kind = 'preset'").get() as { v: number }).v);
    const applied = await stores.content.patch("preset", entity.id, created.revision, patch);
    if (applied.status !== "saved") throw new Error(`one-item patch failed at n=${n}: ${applied.status}`);
    const rows = opened.database.db.query("SELECT COUNT(*) AS count, COALESCE(SUM(length(cell)), 0) AS bytes FROM piece_parts WHERE kind = 'preset' AND from_version > ?").get(beforeVersion) as { count: number; bytes: number };
    if (rows.count !== 1) throw new Error(`one-item patch wrote ${rows.count} physical cells at n=${n}; expected exactly the changed item`);
    const itemBytes = Buffer.byteLength(JSON.stringify(changed), "utf8");
    if (rows.bytes >= 2 * itemBytes + 8_192) throw new Error(`one-item sealed-cell budget exceeded at n=${n}: ${rows.bytes} bytes`);
    if (requestBytes >= itemBytes + 16_384) throw new Error(`one-item request budget exceeded at n=${n}: ${requestBytes} bytes`);
    return { logicalItems: Object.keys(patch.items ?? {}).length, physicalCells: rows.count, sealedBytes: rows.bytes, requestBytes };
  } finally {
    opened.close();
  }
}

try {
  const small = await patchAt(300);
  const large = await patchAt(3_000);
  const observedSmall = await observeWarmPatch(300);
  const observedLarge = await observeWarmPatch(3_000);
  if (small.logicalItems !== 1 || large.logicalItems !== 1 || small.physicalCells !== large.physicalCells) {
    throw new Error(`one-item patch work grew with fixture size: ${JSON.stringify({ small, large })}`);
  }
  console.log(JSON.stringify({ n300: small, n3000: large, warmPatchCipherCalls: { n300: observedSmall, n3000: observedLarge } }));
} finally {
  rmSync(root, { recursive: true, force: true });
}
