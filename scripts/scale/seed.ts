/** Serial scale fixture owner: builds the bounded synthetic library and its exact export/import baseline. */
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Metric } from "./matrix-contract";

interface SeedInput { sandbox: string; release: boolean; n: number; metrics: Record<string, Metric>; fixtureCounts: Record<string, number>; fixtureBytes: Record<string, number> }

export async function seedScale({ sandbox, release, n, metrics, fixtureCounts, fixtureBytes }: SeedInput): Promise<{ studio: string; dbPath: string }> {
  const jsonBytes = (entity: unknown): number => Buffer.byteLength(JSON.stringify(entity));
  const record = <T>(key: string, input: Iterable<T>, consume: (value: T) => Promise<void> | void, countLimit: number): Promise<void> =>
    (async () => {
      let count = 0;
      let bytes = 0;
      for (const entry of input) {
        if (++count > countLimit) throw new Error(`${key} fixture exceeded its admitted count`);
        bytes += jsonBytes(entry);
        await consume(entry);
      }
      fixtureCounts[key] = count;
      fixtureBytes[key] = bytes;
    })();
  const studio = join(sandbox, "studio");
  mkdirSync(studio, { recursive: false });
  const { openLibrary } = await import("../../src/ui/library-root");
  const { cellCipher } = await import("../../src/stage/crypto/cell-cipher");
  const { libraryFor } = await import("../../src/studio/library-content");
  const { sqliteChatStore } = await import("../../src/stage/store/sqlite-chat-store");
  const { countingCipher } = await import("../perf-count-cipher");
  const { SettingsStore } = await import("../../src/studio/settings");
  const { exportLibraryToFolder } = await import("../../src/studio/folder-export");
  const { importFolderIntoLibrary } = await import("../../src/studio/folder-import");
  const { characters } = await import("./fixtures/character");
  const { personas } = await import("./fixtures/persona");
  const { htmldocs } = await import("./fixtures/htmldoc");
  const { preset } = await import("./fixtures/preset");
  const { lorebook } = await import("./fixtures/lorebook");
  const { regexSet } = await import("./fixtures/regex");
  const { pack } = await import("./fixtures/pack");
  const { quickReplySet } = await import("./fixtures/quickreply");
  const { chatSeed, messages, CHAT_SCALE_N, SWIPE_EVERY, SWIPES_PER_MESSAGE } = await import("./fixtures/chat");
  const { fonts, svgs, backgrounds } = await import("./fixtures/asset");
  const { collectionsFile } = await import("./fixtures/studio-document");

  const opened = await openLibrary(studio);
  const cipher = cellCipher(() => opened.keyring.keys());
  const stores = libraryFor(studio);
  if (!stores) throw new Error("opened scale library did not register its stores");
  const { content, state } = stores;
  const chatCipher = countingCipher(cipher);
  const chats = sqliteChatStore(opened.database, chatCipher.cipher);
  try {
    await new SettingsStore(studio).update({ setupComplete: true });
    const extraFixtures = release ? 8 : 0;
    const presetEntity = release ? preset(3_000) : undefined;
    const preset1k = release ? preset(1_000, 2, "scale-preset-1k", 0.5) : undefined;
    await record("character", characters(n, 1), async (entity) => { await content.save(entity); }, 10_000);
    if (release) {
      for (const [key, entity] of [
        ["persona", [...personas(1)][0]!], ["htmldoc", [...htmldocs(1)][0]!], ["preset", presetEntity!],
        ["preset-1k", preset1k!],
        ["lorebook", lorebook(5_000)], ["regex", regexSet(500)], ["pack", pack(300)], ["quickreply", quickReplySet(300)],
      ] as const) {
        fixtureCounts[key] = 1;
        fixtureBytes[key] = jsonBytes(entity);
        await content.save(entity);
      }
      const { presetAdapter } = await import("../../src/formats/sillytavern/preset");
      const importedPreset = presetAdapter.fromCanonical(presetEntity!).text;
      if (!importedPreset) throw new Error("SillyTavern preset fixture failed to serialize for public import route");
      writeFileSync(join(sandbox, "matrix-large-preset.json"), importedPreset);
      fixtureCounts["preset.3000.blocks"] = presetEntity!.body.prompts.length;
      fixtureBytes["preset.3000.json"] = jsonBytes(presetEntity);
      fixtureCounts["preset.1000.blocks"] = preset1k!.body.prompts.length;
      fixtureBytes["preset.1000.json"] = jsonBytes(preset1k);
      fixtureCounts["import.preset_blocks"] = presetEntity!.body.prompts.length;
      fixtureBytes["import.preset_json"] = Buffer.byteLength(importedPreset);
      fixtureCounts["library.total_entities"] = n + extraFixtures;
      const collection = collectionsFile(10_000);
      fixtureCounts["studio.collection_members"] = collection.collections[0]!.members.length;
      fixtureBytes["studio.collection"] = jsonBytes(collection);
      const collectionStart = performance.now();
      await state.write("collections", JSON.stringify(collection));
      const persistedCollections = JSON.parse((await state.read("collections")) ?? "null") as typeof collection | null;
      if (persistedCollections?.collections[0]?.members.length !== 10_000) throw new Error("10k-member collection failed its state-store round trip");
      metrics["studio.collection.persistence_ms"] = { value: performance.now() - collectionStart, unit: "ms" };

      for (const [key, items, measure] of [
        ["font", fonts(50), (item: { bytes: Uint8Array }) => item.bytes.byteLength],
        ["svg", svgs(1_000), (item: { text: string }) => Buffer.byteLength(item.text)],
        ["background", backgrounds(10), (item: { bytes: Uint8Array }) => item.bytes.byteLength],
      ] as const) {
        let count = 0;
        let bytes = 0;
        for (const item of items) { count++; bytes += measure(item as never); }
        fixtureCounts[`assets.${key}`] = count;
        fixtureBytes[`assets.${key}`] = bytes;
      }
      const servedPortrait = backgrounds(1, 37).next().value!.bytes;
      const servedPortraitPath = join(sandbox, "matrix-served-portrait.png");
      writeFileSync(servedPortraitPath, servedPortrait);
      fixtureCounts["assets.served_portrait"] = 1;
      fixtureBytes["assets.served_portrait"] = servedPortrait.byteLength;
      const font = fonts(1, 38).next().value!;
      font.bytes.set([0, 1, 0, 0], 0);
      writeFileSync(join(sandbox, "matrix-font.ttf"), font.bytes);
      writeFileSync(join(sandbox, "matrix-vector.svg"), new TextEncoder().encode(svgs(1, 39).next().value!.text));
      writeFileSync(join(sandbox, "matrix-background.png"), backgrounds(1, 40).next().value!.bytes);
      fixtureCounts["assets.public_persist_delivery_classes"] = 4;
      fixtureBytes["assets.public_font"] = font.bytes.byteLength;
      fixtureBytes["assets.public_svg"] = Buffer.byteLength(svgs(1, 39).next().value!.text);
      fixtureBytes["assets.public_background"] = backgrounds(1, 40).next().value!.bytes.byteLength;
      const { stageAssetUpload, openSessionUploads, consumeSessionUploads } = await import("../../src/ui/server-asset-staging");
      const assetSession = "s21-scale-fixture-session";
      const uploadSamples: number[] = [];
      const upload = async (filename: string, bytes: Uint8Array): Promise<void> => {
        const at = performance.now();
        const response = await stageAssetUpload(new Request("http://127.0.0.1/api/asset/upload", {
          method: "POST", headers: { "content-type": "application/octet-stream", "x-filename": filename }, body: bytes,
        }), assetSession, async () => true);
        if (!response.ok) throw new Error(`asset staging rejected ${filename}: HTTP ${response.status}`);
        const uploaded = await response.json() as { ref?: string; bytes?: number };
        if (uploaded.bytes !== bytes.byteLength || !uploaded.ref) throw new Error(`asset staging returned an invalid receipt for ${filename}`);
        try { await openSessionUploads([uploaded.ref], assetSession); }
        finally { await consumeSessionUploads([uploaded.ref], assetSession); }
        uploadSamples.push(performance.now() - at);
      };
      const smallAssetStart = performance.now();
      for (const font of fonts(5)) { font.bytes.set([0, 1, 0, 0], 0); await upload(`${font.id}.ttf`, font.bytes); }
      for (const svg of svgs(100)) await upload(`${svg.id}.svg`, new TextEncoder().encode(svg.text));
      for (const bg of backgrounds(1)) await upload(`${bg.id}.png`, bg.bytes);
      const smallAssetMs = performance.now() - smallAssetStart;
      const largeSampleStart = uploadSamples.length;
      const largeAssetStart = performance.now();
      for (const font of fonts(50)) {
        font.bytes.set([0, 1, 0, 0], 0); // valid TrueType signature; remaining bytes stay synthetic
        await upload(`${font.id}.ttf`, font.bytes);
      }
      for (const svg of svgs(1_000)) await upload(`${svg.id}.svg`, new TextEncoder().encode(svg.text));
      for (const bg of backgrounds(10)) await upload(`${bg.id}.png`, bg.bytes);
      const largeAssetMs = performance.now() - largeAssetStart;
      const largeSamples = uploadSamples.slice(largeSampleStart).sort((a, b) => a - b);
      metrics["complexity.assets.upload_count_1x"] = { value: 106, unit: "assets", samples: 106, method: "Actual authenticated staging/decrypt/consume operations: 5 fonts, 100 SVGs, and 1 background." };
      metrics["complexity.assets.upload_count_10x"] = { value: largeSamples.length, unit: "assets", samples: largeSamples.length, method: "Same operations at 10x fixture counts: 50 fonts, 1,000 SVGs, and 10 backgrounds." };
      metrics["complexity.assets.upload_time_1x_ms"] = { value: smallAssetMs, unit: "ms", samples: 106 };
      metrics["complexity.assets.upload_time_10x_ms"] = { value: largeAssetMs, unit: "ms", samples: largeSamples.length };
      metrics["complexity.assets.upload_time_ratio_10x"] = { value: largeAssetMs / smallAssetMs, unit: "ratio", samples: 2, method: "Observed staging/decrypt/consume wall-time ratio for 1,060 versus 106 real synthetic uploads." };
      metrics["assets.upload_stage_decrypt_p95_ms"] = { value: largeSamples[Math.floor(largeSamples.length * 0.95)]!, unit: "ms", samples: largeSamples.length };
      metrics["assets.uploaded_count"] = { value: largeSamples.length, unit: "assets", samples: largeSamples.length };

      const listStart = performance.now();
      const listed = await content.summaries();
      metrics["storage.summary_list_10k_ms"] = { value: performance.now() - listStart, unit: "ms" };
      if (listed.entities.length < n) throw new Error(`summary list returned ${listed.entities.length} rows after seeding ${n}`);
      const complexityStudio = join(sandbox, "complexity-1k");
      mkdirSync(complexityStudio);
      const complexityLibrary = await openLibrary(complexityStudio);
      try {
        const complexityCipher = cellCipher(() => complexityLibrary.keyring.keys());
        const complexityStores = libraryFor(complexityStudio);
        if (!complexityStores) throw new Error("opened 1k complexity library did not register its stores");
        const complexityContent = complexityStores.content;
        const complexityChats = sqliteChatStore(complexityLibrary.database, complexityCipher);
        await new SettingsStore(complexityStudio).update({ setupComplete: true });
        let complexityCount = 0;
        for (const entity of characters(1_000, 1)) { await complexityContent.save(entity); complexityCount++; }
        const smallPreset = preset(1_000, 2, "scale-preset-1k", 0.5);
        const complexityKinds = [
          [...personas(1)][0]!, [...htmldocs(1)][0]!, smallPreset, lorebook(5_000), regexSet(500), pack(300), quickReplySet(300),
        ];
        const complexityStart = performance.now();
        const complexityRows = await complexityContent.summaries();
        metrics["complexity.summary_list_1k_ms"] = { value: performance.now() - complexityStart, unit: "ms", samples: complexityRows.entities.length, method: "Real ContentStore summary listing of an isolated 1,000-character corpus; compared with the required 10,000-character release corpus." };
        const characterRows = complexityRows.entities.filter((row) => row.kind === "character");
        if (complexityCount !== 1_000 || characterRows.length !== complexityCount || complexityRows.entities.length !== complexityCount) throw new Error("1k summary complexity corpus was not exactly 1,000 characters");
        metrics["complexity.summary_list_10k_ms"] = { value: metrics["storage.summary_list_10k_ms"]!.value, unit: "ms", samples: listed.entities.length, method: "Real ContentStore summary listing of the 10,000-character release corpus plus its required extra entity fixtures." };
        metrics["complexity.summary_list_10x_time_ratio"] = { value: metrics["complexity.summary_list_10k_ms"]!.value / metrics["complexity.summary_list_1k_ms"]!.value, unit: "ratio", samples: 2, method: "10k summary-list latency divided by the isolated 1k summary-list latency; source records the pair without asserting an invented complexity ceiling." };
        fixtureCounts["complexity.summary_list_1k_entities"] = complexityCount;
        for (const entity of complexityKinds) await complexityContent.save(entity);
        fixtureCounts["complexity.editor_kind_fixtures"] = complexityKinds.length + 1;
        const smallChatSeed = { title: "Complexity Chat 1x", cast: { character: { id: "scale-character-0", version: 1 } }, snapshot: { character: {} } };
        const smallChat = await complexityChats.createChat(smallChatSeed);
        for (const message of messages(400)) {
          if (!(await complexityChats.appendMessage(smallChat.activeBranchId, message))) throw new Error("1x chat complexity append refused");
        }
        const chatStart = performance.now();
        await complexityChats.readMessagesBefore(smallChat.activeBranchId, { limit: 60 });
        metrics["complexity.chat.read_400_ms"] = { value: performance.now() - chatStart, unit: "ms", samples: 1, method: "Warm latest-page read from an isolated 400-message chat in the 1k complexity library." };
        fixtureCounts["complexity.chat.messages_1x"] = 400;
      } finally { complexityLibrary.close(); }

      const exportDir = join(sandbox, "plain-export");
      const exportStart = performance.now();
      const exported = await exportLibraryToFolder(exportDir, {
        content,
        state,
      }, { studioDir: studio });
      metrics["export.full_library_ms"] = { value: performance.now() - exportStart, unit: "ms", samples: exported.pieces, method: "Complete 10k release library export; reported separately from the 30 MB single-piece export budget." };
      fixtureCounts["export.pieces"] = exported.pieces;
      if (exported.pieces < n) throw new Error(`export wrote ${exported.pieces} pieces from ${n} seeded characters`);

      const exportPreset = await content.read("preset", "scale-preset");
      if (!exportPreset) throw new Error("30 MB preset was missing before scoped export");
      const exportStudio = join(sandbox, "export-30mb-library");
      mkdirSync(exportStudio);
      const exportLibrary = await openLibrary(exportStudio);
      try {
        const exportStores = libraryFor(exportStudio);
        if (!exportStores) throw new Error("opened 30 MB export library did not register its stores");
        await exportStores.content.save(exportPreset.entity);
        const largeExportDir = join(sandbox, "export-30mb-piece");
        const largeExportStart = performance.now();
        const largeExport = await exportLibraryToFolder(largeExportDir, exportStores, { studioDir: exportStudio });
        const largeExportPath = join(largeExportDir, "preset", "scale-preset.json");
        const largeExportBytes = statSync(largeExportPath).size;
        if (largeExport.pieces !== 1 || largeExportBytes < 30 * 1024 * 1024) throw new Error(`scoped export wrote ${largeExport.pieces} pieces and ${largeExportBytes} bytes, expected one 30 MB preset`);
        metrics["export_30mb_ms"] = { value: performance.now() - largeExportStart, unit: "ms", samples: 1, method: "Scoped real folder export of the canonical 3,000-block preset only; includes cold full read, serialization, and file write." };
        fixtureCounts["export.30mb_pieces"] = largeExport.pieces;
        fixtureBytes["export.30mb_preset"] = largeExportBytes;
      } finally { exportLibrary.close(); }

      const importStudio = join(sandbox, "import-target");
      mkdirSync(importStudio);
      const importLibrary = await openLibrary(importStudio);
      try {
        const importStores = libraryFor(importStudio);
        if (!importStores) throw new Error("opened import target did not register its stores");
        const { content: importContent, state: importState } = importStores;
        const importStart = performance.now();
        const imported = await importFolderIntoLibrary(exportDir, { content: importContent, state: importState });
        metrics["import_30mb_server_ms"] = { value: performance.now() - importStart, unit: "ms" };
        fixtureCounts["import.pieces"] = imported.pieces;
        if (imported.pieces !== exported.pieces) throw new Error(`import recovered ${imported.pieces} of ${exported.pieces} exported pieces`);
        const goldenKinds = [
          ["character", "scale-character-0"], ["persona", "scale-persona-0"], ["lorebook", "scale-lorebook"],
          ["pack", "scale-pack"], ["regex", "scale-regex"], ["preset", "scale-preset"],
          ["htmldoc", "scale-htmldoc-0"], ["quickreply", "scale-quickreply"],
        ] as const;
        for (const [kind, id] of goldenKinds) {
          const source = await content.read(kind, id);
          const roundTrip = await importContent.read(kind, id);
          if (!source || !roundTrip) {
            throw new Error(kind + "/" + id + " folder export/import differed from its canonical golden");
          }
          const exportedGolden = JSON.parse(readFileSync(join(exportDir, kind, id + ".json"), "utf8")) as unknown;
          if (JSON.stringify(exportedGolden) !== JSON.stringify(source.entity)) throw new Error(kind + "/" + id + " folder export differed from its exact canonical golden");
          const normalizedImport = JSON.parse(JSON.stringify(roundTrip.entity)) as { original?: Record<string, unknown> };
          if (normalizedImport.original) {
            delete normalizedImport.original["vaud-studio"];
            if (!Object.keys(normalizedImport.original).length) delete normalizedImport.original;
          }
          if (JSON.stringify(normalizedImport) !== JSON.stringify(source.entity)) throw new Error(kind + "/" + id + " import changed canonical data outside Studio's reserved stamp");
          metrics["roundtrip." + kind + ".exact"] = { value: 1, unit: "boolean", samples: 1, method: "Exact canonical folder-export file golden plus imported canonical equality after removing only folder import's reserved vaud-studio stamp." };
        }
        fixtureCounts["roundtrip.exact_kinds"] = goldenKinds.length;
      } finally { importLibrary.close(); }

      const lightStart = performance.now();
      if (!(await content.readLight("preset", "scale-preset"))) throw new Error("light preset read failed");
      metrics["storage.preset_light_read_ms"] = { value: performance.now() - lightStart, unit: "ms" };
      const preset1kLightStart = performance.now();
      if (!(await content.readLight("preset", "scale-preset-1k"))) throw new Error("1k light preset read failed");
      metrics["storage.preset_1k_light_read_ms"] = { value: performance.now() - preset1kLightStart, unit: "ms" };
      const charLightStart = performance.now();
      if (!(await content.readLight("character", "scale-character-0"))) throw new Error("light character read failed");
      metrics["storage.character_light_read_ms"] = { value: performance.now() - charLightStart, unit: "ms" };

      await opened.database.scrub();
      const beforeEdits = statSync(join(studio, "library.db")).size;
      const initialPreset = await content.read("preset", "scale-preset");
      if (!initialPreset || initialPreset.entity.kind !== "preset") throw new Error("stored scale-preset was missing or did not parse as a preset");
      let workingPreset = initialPreset.entity;
      for (let save = 0; save < 30; save++) {
        const firstPrompt = workingPreset.body.prompts[0]!;
        workingPreset = { ...workingPreset, body: { ...workingPreset.body, prompts: [{ ...firstPrompt, content: `${firstPrompt.content} ${save}` }, ...workingPreset.body.prompts.slice(1)] } };
        const at = performance.now();
        await content.save(workingPreset, { overwrite: true });
        if (save === 0) metrics["storage.one_part_save_internal_ms"] = { value: performance.now() - at, unit: "ms" };
      }
      await opened.database.scrub();
      const afterEdits = statSync(join(studio, "library.db")).size;
      metrics["history.growth_per_save_bytes"] = { value: Math.max(0, afterEdits - beforeEdits) / 30, unit: "bytes", samples: 30 };
      const restoreStart = performance.now();
      if (!(await content.restoreVersion("preset", "scale-preset", 1))) throw new Error("30 MB preset restore returned no summary");
      metrics["restore_30mb_ms"] = { value: performance.now() - restoreStart, unit: "ms" };

      const trashStart = performance.now();
      if (!(await content.delete("quickreply", "scale-quickreply"))) throw new Error("Trash delete refused");
      const grave = (await content.graveyard("quickreply"))[0];
      if (!grave || !(await content.restore(grave.graveId))) throw new Error("Trash restore failed");
      metrics["trash.round_trip_ms"] = { value: performance.now() - trashStart, unit: "ms" };
    } else {
      fixtureCounts["library.total_entities"] = n;
    }

    const chatCount = release ? CHAT_SCALE_N : 50;
    const seed = release
      ? chatSeed()
      : { title: "Scale Scene", cast: { character: { id: "scale-character-0", version: 1 } }, snapshot: { character: {} } };
    const chat = await chats.createChat(seed);
    let ordinal = 0;
    let forkPoint: string | undefined;
    let chatBytes = jsonBytes(seed.snapshot);
    for (const message of messages(chatCount)) {
      chatBytes += jsonBytes(message);
      const stored = await chats.appendMessage(chat.activeBranchId, message);
      if (!stored) throw new Error(`chat append refused at message ${ordinal}`);
      if (ordinal === Math.floor(chatCount / 2)) forkPoint = stored.id;
      if (release && ordinal % SWIPE_EVERY === 0) {
        for (let swipe = 0; swipe < SWIPES_PER_MESSAGE; swipe++) {
          const result = await chats.addSwipe(stored.id, { content: `${message.content} take ${swipe + 2}` });
          if (!result) throw new Error(`chat swipe refused at message ${ordinal}`);
        }
      }
      ordinal++;
    }
    fixtureCounts["chat.messages"] = ordinal;
    fixtureBytes["chat.snapshot_and_messages"] = chatBytes;
    if (release) {
      if (!forkPoint) throw new Error("chat fixture failed to produce a fork point");
      for (let branch = 1; branch < 3; branch++) {
        if (!(await chats.fork(chat.activeBranchId, forkPoint, { name: `Scale Branch ${branch}` }))) throw new Error(`chat fork ${branch} failed`);
      }
      fixtureCounts["chat.branches"] = (await chats.listBranches(chat.id)).length;
      if (fixtureCounts["chat.branches"] !== 3) throw new Error("chat fixture did not create three branches");
      const transcriptStart = performance.now();
      const tail = await chats.readMessagesBefore(chat.activeBranchId, { limit: 60 });
      metrics["chat.open_4000_ms"] = { value: performance.now() - transcriptStart, unit: "ms" };
      metrics["complexity.chat.read_4000_ms"] = { value: metrics["chat.open_4000_ms"]!.value, unit: "ms", samples: 1, method: "Warm latest-page read from the required 4,000-message release chat; paired with the isolated 400-message control." };
      metrics["complexity.chat.read_ratio_10x"] = { value: metrics["complexity.chat.read_4000_ms"]!.value / metrics["complexity.chat.read_400_ms"]!.value, unit: "ratio", samples: 2, method: "Observed latest-page read latency ratio for 4,000 versus 400 messages." };
      fixtureCounts["chat.transcript_page"] = tail.messages.length;
      await chats.setPreset(chat.id, { id: "scale-preset", toggles: {}, samplers: {} });
      await chats.setLore(chat.id, { added: ["scale-lorebook"], off: [] });
      const { loadTurn, presetReader } = await import("../../src/studio/scene-turn-load");
      const { lorebookReader } = await import("../../src/studio/scene-lore");
      const { assemble } = await import("../../src/core/assembly/assemble");
      const { appBudgeter } = await import("../../src/core/assembly/budget-app");
      const { countFramed, countPrompt, estimate, estimatePart, newCalibration } = await import("../../src/core/tokens");
      const calibration = newCalibration("gemini", 0);
      const measure = { whole: (texts: readonly string[]) => estimate(calibration, countPrompt(texts)).bound, part: (text: string) => estimatePart(calibration, countFramed(text)).bound };
      const sceneStart = performance.now();
      const loaded = await loadTurn(chats, chat.id, "swipe", presetReader({ read: async (kind, id) => {
        const stored = await content.read(kind as never, id);
        return stored ? stored.entity : null;
      } }), lorebookReader({ read: async (kind, id) => {
        const stored = await content.read(kind as never, id);
        return stored ? stored.entity : null;
      } }));
      if (!loaded || !loaded.lore || loaded.lore.books[0]?.body.entries.length !== 5_000 || loaded.preset?.prompts.length !== 3_000) throw new Error("scene turn did not load the seeded 30 MB preset and 5,000-entry lorebook");
      assemble({ ...loaded, globalVariables: new Map(), now: Date.now(), randomSeed: 1, window: { context: 32_000, reply: 2_000 }, budgeter: appBudgeter(measure), lore: { ...loaded.lore, budgetShare: 0.2 } });
      metrics["scene.turn_assembly_ms"] = { value: performance.now() - sceneStart, unit: "ms", samples: 1 };
      chatCipher.reset();
      await chats.readMessagesBefore(chat.activeBranchId, { limit: 60 });
      const swipeOpens = chatCipher.counts()["swipes.content"]?.opens ?? 0;
      metrics["chat.swipe_opens"] = { value: swipeOpens, unit: "opens", samples: 1 };
      if (swipeOpens > 60) throw new Error(`chat transcript opened ${swipeOpens} swipe cells for a 60-message page`);
    }
    opened.close();
  } catch (error) {
    opened.close();
    throw error;
  }
  return { studio, dbPath: join(studio, "library.db") };
}

