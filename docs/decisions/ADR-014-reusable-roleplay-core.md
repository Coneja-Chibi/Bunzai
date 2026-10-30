# ADR-014: One reusable roleplay core for desktop and terminal hosts

**Status:** accepted direction by owner, 2026-10-29; consolidation implementation in progress.
**Owners:** `src/rp-core.ts`, `src/studio/scene-turn.ts`, `src/stage/contracts/chat-store.ts`.

## Decision

Bunzai keeps one turn engine and one canonical scene/state model. The reusable core exposes the current turn orchestration with injected storage, providers and library readers. Skills, trackers, presets, macros, prompt assembly and Final Cut retain their existing owners. Co-developer improvements are absorbed into these owners as they are reconciled; an alternate default engine and separate session journal are not introduced.

The core owns only in-flight execution state: cancellation, gates, background tracker rounds and accepted task completion. ChatStore owns persisted scenes, versions, checkpoints and deltas. A host creates one runtime for each opened store and reuses it across requests. Independent stores may use colliding identifiers. Storage closes only after accepted work settles. No new turn or recovery operation is admitted after shutdown.

Hosts may schedule background work through `afterEvent`; the returned promise must cover its writes. Other host jobs remain the host's responsibility. Imported scripts remain sealed under ADR-009; a terminal without an isolated worker refuses applicable regex instead of evaluating it in-process.

## Current implementation and limits

- Desktop streaming consumes the reusable source API. Runtime state is explicit and shared by the routes for one open store.
- The terminal session runner accepts an injected core and stores, with scripted send/continue/swipe and regex-refusal tests. A standalone shared-library CLI command is withheld.
- Cross-process recovery requires durable ownership/leases. SQLite transaction serialization alone does not identify whether a checkpoint belongs to a live process. No claim of safe simultaneous independent desktop/CLI library owners is made.
- The API bundles for the browser and executes a scripted turn in Node. These checks do not establish packaged-platform or published-package behavior.
- Broader co-developer patch reconciliation remains separate work under the same integration plan. Old repository ancestry remains excluded.
