/**
 * Mutants for the Cast wing's store guards: who a recast may
 * change, the open-reply refusals, and the persona counters (the live-scene guard, the damaged-scene paths,
 * the backfill's slices, its change check and its once-per-message count). Each breaks one guard; the named
 * tests must notice.
 */
import type { NamedMutation } from "./mutation-core";

const STATS = "src/stage/store/sqlite/chat-store-stats.ts";
const CUTS = "src/stage/store/sqlite/chat-store-cuts.ts";
const TURNS = "src/stage/store/sqlite/chat-store-turns.ts";
const MEMORY_CAST = "src/stage/store/memory/chat-store-cast.ts";
const MEMORY_SETTINGS = "src/stage/store/memory/chat-store-settings.ts";
const STATS_TESTS = ["src/stage/store/chat-store.sqlite.stats.test.ts", "src/stage/store/chat-store.sqlite.test.ts"];
const PERSONA_TESTS = ["src/stage/store/chat-store.sqlite.test.ts", "src/stage/store/chat-store.test.ts"];

export const CAST_MUTANTS: NamedMutation[] = [
  {
    name: "persona counters: a scene waiting for its backfill is counted live as well",
    edits: [{ file: STATS, find: "if (personaId && live(chatId)) change(personaId, (row) => { row.scenes += delta; });", replace: "if (personaId) change(personaId, (row) => { row.scenes += delta; });" }],
    tests: STATS_TESTS,
  },
  {
    name: "persona counters: a message sent to a scene waiting for its backfill is counted twice",
    edits: [{ file: STATS, find: "if (!personaId || count === 0 || !live(chatId)) return;", replace: "if (!personaId || count === 0) return;" }],
    tests: STATS_TESTS,
  },
  {
    name: "persona counters: a damaged cast blocks the Trash",
    edits: [{ file: STATS, find: "    } catch {\n      return undefined; // a damaged cast changes no counter, and never blocks the Trash\n    }", replace: "    } catch (e) {\n      throw e;\n    }" }],
    tests: STATS_TESTS,
  },
  {
    name: "persona counters: a scene that will not parse is not set aside",
    edits: [{ file: STATS, find: 'await k.write(() => k.run("UPDATE chats SET stats_state = ? WHERE id = ? AND stats_state = 0", SKIPPED, next.id));', replace: "" }],
    tests: STATS_TESTS,
  },
  {
    name: "persona counters: the backfill counts a forked message once per take",
    edits: [{ file: STATS, find: "        if (seen.has(m.swipe_id)) continue;\n", replace: "" }],
    tests: STATS_TESTS,
  },
  {
    name: "persona counters: the backfill writes totals for a scene that changed while it was read",
    edits: [{ file: STATS, find: "if (fingerprint(chatId) !== before.print || stateOf(chatId) !== 0) return false;", replace: "if (stateOf(chatId) !== 0) return false;" }],
    tests: STATS_TESTS,
  },
  {
    name: "persona counters: the backfill reads a whole scene without handing control back",
    edits: [{ file: STATS, find: "      if (slice.length < SLICE) break;\n      await pause?.();", replace: "      if (slice.length < SLICE) break;" }],
    tests: STATS_TESTS,
  },
  {
    name: "persona counters: a busy library sets a scene aside for good",
    edits: [{ file: STATS, find: "            if (isTransient(error)) continue;\n", replace: "" }],
    tests: STATS_TESTS,
  },
  {
    name: "recast: setCast may change who is played (sqlite)",
    edits: [{ file: CUTS, find: "        refusePersonaChange(current.cast, next.cast);\n", replace: "" }],
    tests: PERSONA_TESTS,
  },
  {
    name: "recast: setCast may change who is played (memory)",
    edits: [{ file: MEMORY_CAST, find: "      refusePersonaChange(record.chat.cast, cast);\n", replace: "" }],
    tests: PERSONA_TESTS,
  },
  {
    name: "recast: a swap is allowed while a reply is open (sqlite)",
    edits: [{ file: CUTS, find: "          refuseWhileTurnOpen(chatId);\n          // The way back stays as it is", replace: "          // The way back stays as it is" }],
    tests: PERSONA_TESTS,
  },
  {
    name: "variant: a look may change while a reply is open (sqlite)",
    edits: [{ file: TURNS, find: "&& k.liveChat(chatId)) throw turnOpenConflict();", replace: "&& false) throw turnOpenConflict();" }],
    tests: PERSONA_TESTS,
  },
  {
    name: "variant: a look may change while a reply is open (memory)",
    edits: [{ file: MEMORY_SETTINGS, find: "if (d.turnOpen(chatId) && d.chats.get(chatId)?.deletedAt === null) throw turnOpenConflict();", replace: "" }],
    tests: PERSONA_TESTS,
  },
];
